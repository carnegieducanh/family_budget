import { describe, expect, it } from 'vitest';
import { budgetId, budgetLevel, getBudgetAmount } from './budget';
import type { Budget } from './types';

function budget(month: string, categoryId: string | null, amount: number, deleted = false): Budget {
  return {
    id: budgetId(month, categoryId),
    month,
    categoryId,
    amount,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'user-a',
    deleted,
  };
}

describe('getBudgetAmount', () => {
  const budgets = [
    budget('default', null, 300000),
    budget('2026-12', null, 400000),
    budget('default', 'cat-grocery', 60000),
    budget('2026-11', 'cat-grocery', 70000, true),
  ];

  it('dùng mức ghi đè của tháng nếu có', () => {
    expect(getBudgetAmount(budgets, '2026-12', null)).toBe(400000);
  });

  it('không có ghi đè thì dùng mức mặc định', () => {
    expect(getBudgetAmount(budgets, '2026-10', null)).toBe(300000);
    expect(getBudgetAmount(budgets, '2026-10', 'cat-grocery')).toBe(60000);
  });

  it('bỏ qua ngân sách đã xóa', () => {
    expect(getBudgetAmount(budgets, '2026-11', 'cat-grocery')).toBe(60000);
  });

  it('chưa đặt thì trả về null', () => {
    expect(getBudgetAmount(budgets, '2026-10', 'cat-rent')).toBeNull();
    expect(getBudgetAmount([], '2026-10', null)).toBeNull();
  });

  it('id cố định theo tháng và danh mục', () => {
    expect(budgetId('default', null)).toBe('budget-default-total');
    expect(budgetId('2026-10', 'cat-rent')).toBe('budget-2026-10-cat-rent');
  });
});

describe('budgetLevel', () => {
  it('đổi màu khi vượt 80% và khi vượt 100%', () => {
    expect(budgetLevel(80000, 100000)).toBe('ok');
    expect(budgetLevel(80001, 100000)).toBe('warning');
    expect(budgetLevel(100000, 100000)).toBe('warning');
    expect(budgetLevel(100001, 100000)).toBe('over');
  });
});
