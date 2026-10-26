import { DomainError } from './errors';
import { formatMonthLabel, isPastMonth } from './month';
import { createRecord, touch } from './records';
import type { MonthRecord, Transaction } from './types';

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
 * So sánh số tiền bù hiện tại với lúc bấm "Đã thanh toán".
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

/** Đánh dấu đã thanh toán: lưu số tiền bù và người trả bù tại thời điểm bấm. */
export function markSettled(
  months: readonly MonthRecord[],
  settlement: Settlement,
  userId: string,
  now: Date,
): MonthRecord {
  const { month } = settlement;
  if (!isPastMonth(month, now)) {
    throw new DomainError(`${formatMonthLabel(month)} chưa kết thúc, chỉ có số tạm tính.`);
  }
  const fields = {
    settledAt: now.toISOString(),
    settledBy: userId,
    settledAmount: settlement.amount,
    ...(settlement.payer ? { settledPayer: settlement.payer } : {}),
  };
  const existing = findMonthRecord(months, month);
  if (!existing) {
    return createRecord<MonthRecord>(monthRecordId(month), { month, ...fields }, userId, now);
  }
  const { settledPayer, ...rest } = existing;
  return touch(rest as MonthRecord, fields, userId, now);
}
