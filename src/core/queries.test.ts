import { describe, expect, it } from 'vitest';
import {
  activeMonths,
  filterTransactions,
  monthlyTotals,
  normalizeSearchText,
  recentTransactions,
  sortTransactions,
  spendingByCategory,
  transactionsInMonth,
} from './queries';
import { NOW, makeData, makeTx } from './testing';

const A = 'user-a';
const B = 'user-b';

const list = [
  makeTx({ id: 't1', date: '2026-10-01', amount: 3000, paidBy: A, note: 'Tiền điện' }),
  makeTx({ id: 't2', date: '2026-10-05', amount: 80000, paidBy: B, categoryId: 'cat-rent' }),
  makeTx({ id: 't3', date: '2026-10-05', amount: 1200, paidBy: A, note: 'Cơm trưa' }),
  makeTx({ id: 't4', date: '2026-10-20', amount: 500, paidBy: B, deleted: true }),
  makeTx({ id: 't5', date: '2026-09-30', amount: 7000, paidBy: A }),
];
// t3 nhập sau t2 trong cùng ngày
list[2]!.createdAt = '2026-10-05T10:00:00.000Z';
list[1]!.createdAt = '2026-10-05T09:00:00.000Z';

describe('transactionsInMonth', () => {
  it('chỉ lấy khoản chưa xóa của đúng tháng', () => {
    expect(transactionsInMonth(list, '2026-10').map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });
});

describe('sortTransactions', () => {
  it('theo ngày mới nhất, cùng ngày thì khoản nhập sau đứng trước', () => {
    const ids = sortTransactions(transactionsInMonth(list, '2026-10'), 'date-desc').map(
      (t) => t.id,
    );
    expect(ids).toEqual(['t3', 't2', 't1']);
  });

  it('theo số tiền tăng và giảm dần', () => {
    const month = transactionsInMonth(list, '2026-10');
    expect(sortTransactions(month, 'amount-asc').map((t) => t.id)).toEqual(['t3', 't1', 't2']);
    expect(sortTransactions(month, 'amount-desc').map((t) => t.id)).toEqual(['t2', 't1', 't3']);
  });

  it('không đổi mảng gốc', () => {
    const month = transactionsInMonth(list, '2026-10');
    sortTransactions(month, 'amount-asc');
    expect(month.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });
});

describe('filterTransactions', () => {
  const month = transactionsInMonth(list, '2026-10');

  it('lọc theo danh mục và người trả', () => {
    expect(filterTransactions(month, { categoryId: 'cat-rent' }).map((t) => t.id)).toEqual(['t2']);
    expect(filterTransactions(month, { paidBy: A }).map((t) => t.id)).toEqual(['t1', 't3']);
    expect(filterTransactions(month, { categoryId: null, paidBy: null })).toHaveLength(3);
  });

  it('tìm theo ghi chú không phân biệt dấu và hoa thường', () => {
    expect(filterTransactions(month, { search: 'dien' }).map((t) => t.id)).toEqual(['t1']);
    expect(filterTransactions(month, { search: 'CƠM' }).map((t) => t.id)).toEqual(['t3']);
    expect(filterTransactions(month, { search: '   ' })).toHaveLength(3);
  });

  it('normalizeSearchText bỏ dấu tiếng Việt, kể cả chữ đ', () => {
    expect(normalizeSearchText('Điện Nước Gas')).toBe('dien nuoc gas');
    expect(normalizeSearchText('Quà Hiếu hỉ')).toBe('qua hieu hi');
  });
});

describe('recentTransactions', () => {
  it('lấy tối đa N khoản gần nhất của tháng, bỏ khoản đã xóa', () => {
    expect(recentTransactions(list, '2026-10', 2).map((t) => t.id)).toEqual(['t3', 't2']);
    expect(recentTransactions(list, '2026-10').map((t) => t.id)).toEqual(['t3', 't2', 't1']);
  });
});

describe('spendingByCategory', () => {
  it('cộng theo danh mục, nhiều nhất trước', () => {
    expect(spendingByCategory(list, '2026-10')).toEqual([
      { categoryId: 'cat-rent', amount: 80000 },
      { categoryId: 'cat-grocery', amount: 4200 },
    ]);
  });
});

describe('activeMonths', () => {
  it('gồm tháng hiện tại, tháng có khoản chi và tháng đã tất toán, mới nhất trước', () => {
    const { data } = makeData();
    data.transactions = list;
    data.months = [
      {
        id: 'month-2026-06',
        month: '2026-06',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
        updatedBy: A,
        deleted: false,
        settledAt: '2026-07-01T00:00:00.000Z',
      },
    ];
    expect(activeMonths(data, NOW)).toEqual(['2026-10', '2026-09', '2026-06']);
  });
});

describe('monthlyTotals', () => {
  it('12 tháng liên tiếp kết thúc ở tháng chọn, tháng không có khoản nào là 0', () => {
    const txs = [
      makeTx({ date: '2026-10-05', amount: 1000, paidBy: 'user-a' }),
      makeTx({ date: '2026-10-20', amount: 500, paidBy: 'user-b' }),
      makeTx({ date: '2025-11-01', amount: 200, paidBy: 'user-a' }),
      makeTx({ date: '2025-10-31', amount: 999, paidBy: 'user-a' }),
      makeTx({ date: '2026-03-03', amount: 50, paidBy: 'user-a', deleted: true }),
    ];
    const totals = monthlyTotals(txs, '2026-10');
    expect(totals).toHaveLength(12);
    expect(totals[0]).toEqual({ month: '2025-11', total: 200 });
    expect(totals[11]).toEqual({ month: '2026-10', total: 1500 });
    expect(totals.find((t) => t.month === '2026-03')?.total).toBe(0);
  });
});
