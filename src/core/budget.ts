import type { Budget } from './types';

export function budgetId(month: string, categoryId: string | null): string {
  return `budget-${month}-${categoryId ?? 'total'}`;
}

/**
 * Ngân sách áp dụng cho tháng: mức ghi đè của tháng nếu có, nếu không thì mức mặc định.
 * `categoryId = null` là ngân sách tổng. Trả về null khi chưa đặt.
 */
export function getBudgetAmount(
  budgets: readonly Budget[],
  month: string,
  categoryId: string | null,
): number | null {
  const find = (m: string) =>
    budgets.find((b) => !b.deleted && b.month === m && b.categoryId === categoryId);
  return (find(month) ?? find('default'))?.amount ?? null;
}

export type BudgetLevel = 'ok' | 'warning' | 'over';

/** Đổi màu khi vượt 80% và khi vượt 100% ngân sách (SPEC mục 8). */
export function budgetLevel(spent: number, budget: number): BudgetLevel {
  if (spent > budget) return 'over';
  if (spent > budget * 0.8) return 'warning';
  return 'ok';
}
