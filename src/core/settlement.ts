import { DomainError } from './errors';
import { householdUsers } from './household';
import { formatDate, formatMonthLabel, isPastMonth, lastDayOfMonth, toLocalDate } from './month';
import { createRecord, touch } from './records';
import type { DataFile, MonthRecord, Transaction } from './types';

// Tất toán 50/50 (SPEC mục 6).

export function monthRecordId(month: string): string {
  return `month-${month}`;
}

/** Bản ghi tháng còn hiệu lực (bỏ qua bản đã xóa mềm). */
export function findMonthRecord(
  months: readonly MonthRecord[],
  month: string,
): MonthRecord | undefined {
  return months.find((record) => record.month === month && !record.deleted);
}

export interface Settlement {
  month: string;
  total: number;
  paidByUser: Record<string, number>;
  /** total / 2, có thể lẻ 0.5 yên; chỉ để hiển thị. */
  sharePerPerson: number;
  /** Người trả ít hơn, phải trả bù. null khi hai người trả bằng nhau. */
  payer: string | null;
  receiver: string | null;
  /** floor(|P_A − P_B| / 2), làm tròn xuống đến 1 yên. */
  amount: number;
}

export function computeSettlement(
  transactions: readonly Transaction[],
  userIds: readonly [string, string],
  month: string,
): Settlement {
  const [a, b] = userIds;
  const paidByUser: Record<string, number> = { [a]: 0, [b]: 0 };
  let total = 0;

  for (const tx of transactions) {
    if (tx.deleted || !tx.date.startsWith(`${month}-`)) continue;
    total += tx.amount;
    if (tx.paidBy in paidByUser) paidByUser[tx.paidBy] = (paidByUser[tx.paidBy] ?? 0) + tx.amount;
  }

  const paidA = paidByUser[a] ?? 0;
  const paidB = paidByUser[b] ?? 0;
  const amount = Math.floor(Math.abs(paidA - paidB) / 2);
  const payer = amount === 0 ? null : paidA < paidB ? a : b;
  const receiver = payer === null ? null : payer === a ? b : a;

  return { month, total, paidByUser, sharePerPerson: total / 2, payer, receiver, amount };
}

export interface SettlementChange {
  before: number;
  after: number;
  beforePayer: string | null;
  afterPayer: string | null;
}

/**
 * So sánh số tiền bù hiện tại với lúc tất toán.
 * Trả về null nếu chưa tất toán hoặc không có gì thay đổi.
 */
export function settlementChange(
  record: MonthRecord | undefined,
  settlement: Settlement,
): SettlementChange | null {
  if (!record?.settledAt || record.settledAmount === undefined) return null;
  const beforePayer = record.settledPayer ?? null;
  if (record.settledAmount === settlement.amount && beforePayer === settlement.payer) return null;
  return {
    before: record.settledAmount,
    after: settlement.amount,
    beforePayer,
    afterPayer: settlement.payer,
  };
}

// Tất toán hai bước: một người bấm "Tất toán" (gửi yêu cầu), người kia đồng ý thì tháng mới
// được đánh dấu đã thanh toán. Yêu cầu nằm trong bản ghi tháng nên đi qua sync như dữ liệu khác.

/** Nút "Tất toán" có từ ngày cuối tháng (giờ local) trở đi. */
export function canSettle(month: string, now: Date): boolean {
  return toLocalDate(now) >= lastDayOfMonth(month);
}

/** Số tiền còn là tạm tính: tháng chưa qua và chưa tất toán. */
export function isProvisional(record: MonthRecord | undefined, month: string, now: Date): boolean {
  return !isPastMonth(month, now) && !record?.settledAt;
}

export interface SettlementRequest {
  at: string;
  by: string;
  amount: number;
  payer: string | null;
  /** Số tiền bù hoặc người trả bù đã đổi sau khi gửi: không đồng ý được, phải gửi lại. */
  outdated: boolean;
}

/** Yêu cầu tất toán đang chờ người kia đồng ý, hoặc null. */
export function settlementRequest(
  record: MonthRecord | undefined,
  settlement: Settlement,
): SettlementRequest | null {
  if (!record?.settleRequestedAt || !record.settleRequestedBy) return null;
  if (record.settleRequestedAmount === undefined) return null;
  const payer = record.settleRequestedPayer ?? null;
  return {
    at: record.settleRequestedAt,
    by: record.settleRequestedBy,
    amount: record.settleRequestedAmount,
    payer,
    outdated: record.settleRequestedAmount !== settlement.amount || payer !== settlement.payer,
  };
}

export interface IncomingRequest {
  settlement: Settlement;
  request: SettlementRequest;
}

/** Các yêu cầu người kia gửi mà `userId` cần đồng ý (bỏ yêu cầu đã cũ), tháng cũ trước. */
export function incomingRequests(data: DataFile, userId: string): IncomingRequest[] {
  const [a, b] = householdUsers(data);
  return data.months
    .filter((record) => !record.deleted)
    .sort((x, y) => (x.month < y.month ? -1 : x.month > y.month ? 1 : 0))
    .flatMap((record) => {
      const settlement = computeSettlement(data.transactions, [a.id, b.id], record.month);
      const request = settlementRequest(record, settlement);
      return request && !request.outdated && request.by !== userId ? [{ settlement, request }] : [];
    });
}

/** Bản ghi tháng bỏ các trường của yêu cầu tất toán. */
function withoutRequest(record: MonthRecord): MonthRecord {
  const {
    settleRequestedAt,
    settleRequestedBy,
    settleRequestedAmount,
    settleRequestedPayer,
    ...rest
  } = record;
  return rest;
}

/** Bấm "Tất toán": gửi yêu cầu với số tiền bù hiện tại, chờ người kia đồng ý. */
export function requestSettlement(
  months: readonly MonthRecord[],
  settlement: Settlement,
  userId: string,
  now: Date,
): MonthRecord {
  const { month } = settlement;
  if (!canSettle(month, now)) {
    throw new DomainError(
      `${formatMonthLabel(month)} chỉ tất toán được từ ngày cuối tháng (${formatDate(lastDayOfMonth(month))}).`,
    );
  }
  if (settlement.amount === 0 || !settlement.payer) {
    throw new DomainError('Không ai cần trả bù tháng này.');
  }
  const existing = findMonthRecord(months, month);
  if (existing?.settledAt && !settlementChange(existing, settlement)) {
    throw new DomainError(`${formatMonthLabel(month)} đã thanh toán.`);
  }
  const fields = {
    settleRequestedAt: now.toISOString(),
    settleRequestedBy: userId,
    settleRequestedAmount: settlement.amount,
    settleRequestedPayer: settlement.payer,
  };
  if (!existing) {
    return createRecord<MonthRecord>(monthRecordId(month), { month, ...fields }, userId, now);
  }
  return touch(withoutRequest(existing), fields, userId, now);
}

/** Người kia đồng ý: đánh dấu đã thanh toán với đúng số tiền của yêu cầu. */
export function acceptSettlement(
  months: readonly MonthRecord[],
  settlement: Settlement,
  userId: string,
  now: Date,
): MonthRecord {
  const existing = findMonthRecord(months, settlement.month);
  const request = settlementRequest(existing, settlement);
  if (!existing || !request) throw new DomainError('Không có yêu cầu tất toán nào đang chờ.');
  if (request.by === userId) {
    throw new DomainError('Yêu cầu do bạn gửi, cần người kia đồng ý.');
  }
  if (request.outdated) {
    throw new DomainError('Số tiền đã đổi sau khi gửi yêu cầu, cần gửi lại yêu cầu tất toán.');
  }
  const { settledPayer, ...rest } = withoutRequest(existing);
  const fields = {
    settledAt: now.toISOString(),
    settledBy: userId,
    settledAmount: request.amount,
    ...(request.payer ? { settledPayer: request.payer } : {}),
  };
  return touch(rest as MonthRecord, fields, userId, now);
}

/** Người gửi hủy yêu cầu đang chờ (bấm nhầm, hoặc số tiền đã đổi). */
export function cancelSettlementRequest(
  months: readonly MonthRecord[],
  month: string,
  userId: string,
  now: Date,
): MonthRecord {
  const existing = findMonthRecord(months, month);
  if (!existing?.settleRequestedAt) {
    throw new DomainError('Không có yêu cầu tất toán nào đang chờ.');
  }
  if (existing.settleRequestedBy !== userId) {
    throw new DomainError('Chỉ người gửi yêu cầu mới hủy được.');
  }
  return touch(withoutRequest(existing), {}, userId, now);
}
