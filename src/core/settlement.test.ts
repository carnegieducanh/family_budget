import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import {
  acceptSettlement,
  canSettle,
  cancelSettlementRequest,
  computeSettlement,
  incomingRequests,
  isProvisional,
  requestSettlement,
  settlementChange,
  settlementRequest,
  type Settlement,
} from './settlement';
import { NOW, localTime, makeData, makeTx } from './testing';
import type { MonthRecord } from './types';

const A = 'user-a';
const B = 'user-b';
const MONTH = '2026-09';

function paid(amountA: number, amountB: number) {
  return [
    makeTx({ date: `${MONTH}-10`, amount: amountA, paidBy: A }),
    makeTx({ date: `${MONTH}-12`, amount: amountB, paidBy: B }),
  ].filter((tx) => tx.amount > 0);
}

describe('computeSettlement — ví dụ ở SPEC mục 6', () => {
  it('A ¥180,000, B ¥95,000 → B trả A ¥42,500', () => {
    const s = computeSettlement(paid(180000, 95000), [A, B], MONTH);
    expect(s).toEqual({
      month: MONTH,
      total: 275000,
      paidByUser: { [A]: 180000, [B]: 95000 },
      sharePerPerson: 137500,
      payer: B,
      receiver: A,
      amount: 42500,
    });
  });

  it('A ¥50,000, B ¥50,000 → không ai trả bù', () => {
    const s = computeSettlement(paid(50000, 50000), [A, B], MONTH);
    expect(s.total).toBe(100000);
    expect(s.sharePerPerson).toBe(50000);
    expect(s.amount).toBe(0);
    expect(s.payer).toBeNull();
    expect(s.receiver).toBeNull();
  });

  it('A ¥1,001, B ¥0 → B trả A ¥500 (làm tròn xuống)', () => {
    const s = computeSettlement(paid(1001, 0), [A, B], MONTH);
    expect(s.total).toBe(1001);
    expect(s.sharePerPerson).toBe(500.5);
    expect(s.paidByUser).toEqual({ [A]: 1001, [B]: 0 });
    expect(s.payer).toBe(B);
    expect(s.receiver).toBe(A);
    expect(s.amount).toBe(500);
  });
});

describe('computeSettlement — các trường hợp khác', () => {
  it('người trả bù là người trả ít hơn, không phụ thuộc thứ tự userIds', () => {
    const s = computeSettlement(paid(20000, 60000), [A, B], MONTH);
    expect(s.payer).toBe(A);
    expect(s.receiver).toBe(B);
    expect(s.amount).toBe(20000);
    expect(computeSettlement(paid(20000, 60000), [B, A], MONTH).payer).toBe(A);
  });

  it('chênh lệch ¥1 → không ai trả bù', () => {
    const s = computeSettlement(paid(1001, 1000), [A, B], MONTH);
    expect(s.amount).toBe(0);
    expect(s.payer).toBeNull();
  });

  it('bỏ qua khoản đã xóa và khoản của tháng khác', () => {
    const transactions = [
      makeTx({ date: `${MONTH}-01`, amount: 10000, paidBy: A }),
      makeTx({ date: `${MONTH}-02`, amount: 99999, paidBy: B, deleted: true }),
      makeTx({ date: '2026-10-01', amount: 50000, paidBy: B }),
      makeTx({ date: '2026-08-31', amount: 50000, paidBy: B }),
    ];
    const s = computeSettlement(transactions, [A, B], MONTH);
    expect(s.total).toBe(10000);
    expect(s.paidByUser).toEqual({ [A]: 10000, [B]: 0 });
    expect(s.amount).toBe(5000);
  });

  it('tháng không có khoản nào', () => {
    const s = computeSettlement([], [A, B], MONTH);
    expect(s).toMatchObject({ total: 0, sharePerPerson: 0, amount: 0, payer: null });
  });
});

describe('canSettle — nút Tất toán có từ ngày cuối tháng', () => {
  it('chưa có trước ngày cuối tháng, có từ 0 giờ ngày cuối tháng', () => {
    expect(canSettle('2026-10', localTime(2026, 10, 30, 23, 59, 59))).toBe(false);
    expect(canSettle('2026-10', localTime(2026, 10, 31, 0, 0, 0))).toBe(true);
    expect(canSettle('2026-09', localTime(2026, 9, 30, 0, 0, 0))).toBe(true);
  });

  it('tháng đã qua vẫn tất toán được, tháng sau thì chưa', () => {
    expect(canSettle('2026-09', NOW)).toBe(true);
    expect(canSettle('2026-11', NOW)).toBe(false);
  });

  it('tháng 2 năm thường và năm nhuận', () => {
    expect(canSettle('2026-02', localTime(2026, 2, 28))).toBe(true);
    expect(canSettle('2028-02', localTime(2028, 2, 28))).toBe(false);
    expect(canSettle('2028-02', localTime(2028, 2, 29))).toBe(true);
  });
});

describe('tất toán hai bước: gửi yêu cầu, người kia đồng ý', () => {
  const settlement = computeSettlement(paid(180000, 95000), [A, B], MONTH);
  const LATER = localTime(2026, 10, 24);

  /** A gửi yêu cầu lúc NOW, B đồng ý lúc LATER. */
  function settle(s: Settlement = settlement): MonthRecord {
    const requested = requestSettlement([], s, A, NOW);
    return acceptSettlement([requested], s, B, LATER);
  }

  it('gửi yêu cầu: lưu số tiền bù và người trả bù lúc gửi, chưa đánh dấu đã thanh toán', () => {
    const record = requestSettlement([], settlement, A, NOW);
    expect(record).toMatchObject({
      id: `month-${MONTH}`,
      month: MONTH,
      settleRequestedAt: NOW.toISOString(),
      settleRequestedBy: A,
      settleRequestedAmount: 42500,
      settleRequestedPayer: B,
      updatedBy: A,
      deleted: false,
    });
    expect(record.settledAt).toBeUndefined();
    expect(settlementRequest(record, settlement)).toEqual({
      at: NOW.toISOString(),
      by: A,
      amount: 42500,
      payer: B,
      outdated: false,
    });
  });

  it('người kia đồng ý: đánh dấu đã thanh toán, bỏ yêu cầu', () => {
    const record = settle();
    expect(record).toMatchObject({
      settledAt: LATER.toISOString(),
      settledBy: B,
      settledAmount: 42500,
      settledPayer: B,
      updatedBy: B,
    });
    expect(record.settleRequestedAt).toBeUndefined();
    expect(record.settleRequestedBy).toBeUndefined();
    expect(record.settleRequestedAmount).toBeUndefined();
    expect(record.settleRequestedPayer).toBeUndefined();
    expect(settlementRequest(record, settlement)).toBeNull();
  });

  it('người gửi không tự đồng ý được', () => {
    const requested = requestSettlement([], settlement, A, NOW);
    expect(() => acceptSettlement([requested], settlement, A, LATER)).toThrow(DomainError);
  });

  it('không có yêu cầu thì không đồng ý được', () => {
    expect(() => acceptSettlement([], settlement, B, LATER)).toThrow(DomainError);
  });

  it('số tiền đổi sau khi gửi: yêu cầu cũ, không đồng ý được, gửi lại được', () => {
    const requested = requestSettlement([], settlement, A, NOW);
    const after = computeSettlement(paid(190000, 95000), [A, B], MONTH);
    expect(settlementRequest(requested, after)?.outdated).toBe(true);
    expect(() => acceptSettlement([requested], after, B, LATER)).toThrow(DomainError);

    const again = requestSettlement([requested], after, B, LATER);
    expect(again).toMatchObject({ settleRequestedBy: B, settleRequestedAmount: 47500 });
    expect(acceptSettlement([again], after, A, LATER).settledAmount).toBe(47500);
  });

  it('người gửi hủy được yêu cầu, người kia thì không', () => {
    const requested = requestSettlement([], settlement, A, NOW);
    expect(() => cancelSettlementRequest([requested], MONTH, B, LATER)).toThrow(DomainError);
    const cancelled = cancelSettlementRequest([requested], MONTH, A, LATER);
    expect(cancelled.settleRequestedAt).toBeUndefined();
    expect(cancelled.updatedAt).toBe(LATER.toISOString());
    expect(settlementRequest(cancelled, settlement)).toBeNull();
    expect(() => cancelSettlementRequest([cancelled], MONTH, A, LATER)).toThrow(DomainError);
  });

  it('chưa đến ngày cuối tháng thì chưa gửi được', () => {
    const tx = makeTx({ date: '2026-10-05', amount: 1000, paidBy: A });
    const october = computeSettlement([tx], [A, B], '2026-10');
    expect(() => requestSettlement([], october, A, NOW)).toThrow(DomainError);
    expect(() => requestSettlement([], october, A, localTime(2026, 10, 31, 9))).not.toThrow();
  });

  it('không ai cần trả bù thì không gửi yêu cầu', () => {
    const even = computeSettlement(paid(50000, 50000), [A, B], MONTH);
    expect(() => requestSettlement([], even, A, NOW)).toThrow(DomainError);
  });

  it('tháng đã thanh toán với đúng số tiền hiện tại thì không gửi lại', () => {
    expect(() => requestSettlement([settle()], settlement, A, LATER)).toThrow(DomainError);
  });

  it('tất toán lại sau khi số tiền đổi: giữ lần tất toán cũ đến khi người kia đồng ý', () => {
    const after = computeSettlement(paid(190000, 95000), [A, B], MONTH);
    const requested = requestSettlement([settle()], after, A, LATER);
    expect(requested).toMatchObject({ settledAmount: 42500, settleRequestedAmount: 47500 });
    expect(settlementChange(requested, after)).not.toBeNull();
    const resettled = acceptSettlement([requested], after, B, LATER);
    expect(settlementChange(resettled, after)).toBeNull();
    expect(resettled.settledAmount).toBe(47500);
  });

  it('giữ trường do bản app cũ ghi và thời điểm tạo của bản ghi tháng', () => {
    // Bản 0.2.0 trở về trước ghi `manualUnlockUntil` (mở khóa tạm); máy còn chạy bản đó vẫn đọc.
    const existing = {
      id: `month-${MONTH}`,
      month: MONTH,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      updatedBy: A,
      deleted: false,
      manualUnlockUntil: '2026-10-24T00:00:00.000Z',
    };
    const requested = requestSettlement([existing], settlement, A, NOW);
    const record = acceptSettlement([requested], settlement, B, LATER);
    expect(record).toMatchObject({ manualUnlockUntil: existing.manualUnlockUntil });
    expect(record.createdAt).toBe(existing.createdAt);
    expect(record.settledAmount).toBe(42500);
  });

  it('không cảnh báo khi số tiền không đổi hoặc chưa tất toán', () => {
    expect(settlementChange(settle(), settlement)).toBeNull();
    expect(settlementChange(undefined, settlement)).toBeNull();
  });

  it('cảnh báo khi số tiền bù thay đổi sau tất toán', () => {
    const after = computeSettlement(paid(190000, 95000), [A, B], MONTH);
    expect(settlementChange(settle(), after)).toEqual({
      before: 42500,
      after: 47500,
      beforePayer: B,
      afterPayer: B,
    });
  });

  it('cảnh báo khi đổi chiều trả bù dù số tiền như cũ', () => {
    const flipped = computeSettlement(paid(95000, 180000), [A, B], MONTH);
    expect(settlementChange(settle(), flipped)).toMatchObject({ beforePayer: B, afterPayer: A });
  });

  it('tạm tính khi tháng chưa qua và chưa tất toán', () => {
    expect(isProvisional(undefined, '2026-10', NOW)).toBe(true);
    expect(isProvisional(undefined, MONTH, NOW)).toBe(false);
    const tx = makeTx({ date: '2026-10-05', amount: 1000, paidBy: A });
    const october = computeSettlement([tx], [A, B], '2026-10');
    const lastDay = localTime(2026, 10, 31, 9);
    const requested = requestSettlement([], october, A, lastDay);
    expect(isProvisional(requested, '2026-10', lastDay)).toBe(true);
    const settled = acceptSettlement([requested], october, B, lastDay);
    expect(isProvisional(settled, '2026-10', lastDay)).toBe(false);
  });
});

describe('incomingRequests — yêu cầu người kia gửi, cần mình đồng ý', () => {
  it('chỉ lấy yêu cầu của người kia còn đúng số tiền, tháng cũ trước', () => {
    const { data, a, b } = makeData();
    const transactions = [
      makeTx({ date: '2026-08-05', amount: 10000, paidBy: a }),
      makeTx({ date: '2026-09-05', amount: 20000, paidBy: a }),
      makeTx({ date: '2026-07-05', amount: 30000, paidBy: b }),
    ];
    const settlementOf = (month: string) => computeSettlement(transactions, [a, b], month);
    const months = [
      requestSettlement([], settlementOf('2026-09'), a, NOW),
      requestSettlement([], settlementOf('2026-08'), a, NOW),
      requestSettlement([], settlementOf('2026-07'), b, NOW), // do b gửi
    ];
    const full = { ...data, transactions, months };

    expect(incomingRequests(full, b).map((item) => item.settlement.month)).toEqual([
      '2026-08',
      '2026-09',
    ]);
    expect(incomingRequests(full, a).map((item) => item.settlement.month)).toEqual(['2026-07']);

    // Thêm khoản vào tháng 9 sau khi gửi: yêu cầu tháng 9 đã cũ, không báo nữa.
    const changed = {
      ...full,
      transactions: [...transactions, makeTx({ date: '2026-09-20', amount: 4000, paidBy: b })],
    };
    expect(incomingRequests(changed, b).map((item) => item.settlement.month)).toEqual(['2026-08']);
  });
});
