import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import { computeSettlement, markSettled, settlementChange } from './settlement';
import { NOW, localTime, makeTx } from './testing';
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

describe('markSettled và settlementChange', () => {
  const settlement = computeSettlement(paid(180000, 95000), [A, B], MONTH);

  it('lưu số tiền bù và người trả bù vào bản ghi tháng', () => {
    const record = markSettled([], settlement, B, NOW);
    expect(record).toMatchObject({
      id: `month-${MONTH}`,
      month: MONTH,
      settledAt: NOW.toISOString(),
      settledBy: B,
      settledAmount: 42500,
      settledPayer: B,
      updatedBy: B,
      deleted: false,
    });
  });

  it('giữ nguyên trạng thái mở khóa tạm khi cập nhật bản ghi tháng có sẵn', () => {
    const existing: MonthRecord = {
      id: `month-${MONTH}`,
      month: MONTH,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      updatedBy: A,
      deleted: false,
      manualUnlockUntil: '2026-10-24T00:00:00.000Z',
    };
    const record = markSettled([existing], settlement, A, NOW);
    expect(record.manualUnlockUntil).toBe(existing.manualUnlockUntil);
    expect(record.createdAt).toBe(existing.createdAt);
    expect(record.settledAmount).toBe(42500);
  });

  it('không cho tất toán tháng hiện tại', () => {
    const current = computeSettlement([], [A, B], '2026-10');
    expect(() => markSettled([], current, A, NOW)).toThrow(DomainError);
  });

  it('cho tất toán từ ngày 1 của tháng sau', () => {
    const october = computeSettlement([], [A, B], '2026-10');
    expect(() => markSettled([], october, A, localTime(2026, 11, 1, 0, 0, 0))).not.toThrow();
  });

  it('không cảnh báo khi số tiền không đổi hoặc chưa tất toán', () => {
    const record = markSettled([], settlement, B, NOW);
    expect(settlementChange(record, settlement)).toBeNull();
    expect(settlementChange(undefined, settlement)).toBeNull();
  });

  it('cảnh báo khi số tiền bù thay đổi sau tất toán', () => {
    const record = markSettled([], settlement, B, NOW);
    const after = computeSettlement(paid(190000, 95000), [A, B], MONTH);
    expect(settlementChange(record, after)).toEqual({
      before: 42500,
      after: 47500,
      beforePayer: B,
      afterPayer: B,
    });
  });

  it('cảnh báo khi đổi chiều trả bù dù số tiền như cũ', () => {
    const record = markSettled([], settlement, B, NOW);
    const flipped = computeSettlement(paid(95000, 180000), [A, B], MONTH);
    expect(settlementChange(record, flipped)).toMatchObject({ beforePayer: B, afterPayer: A });
  });
});
