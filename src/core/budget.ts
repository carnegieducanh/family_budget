import { DomainError } from './errors';
import { formatMonthLabel, isValidMonth } from './month';
import { findMonthRecord, isLocked } from './monthLock';
import { active, createRecord, softDelete, touch } from './records';
import { spendingByCategory } from './queries';
import type { Budget, DataFile, MutationContext } from './types';

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

/** Mức ngân sách mặc định, áp dụng cho mọi tháng chưa có mức riêng. */
export const DEFAULT_BUDGET_MONTH = 'default';

/** Bản ghi ngân sách theo id cố định, kể cả bản đã xóa mềm. */
export function findBudget(
  budgets: readonly Budget[],
  month: string,
  categoryId: string | null,
): Budget | undefined {
  const id = budgetId(month, categoryId);
  return budgets.find((b) => b.id === id);
}

/**
 * Đặt ngân sách (tổng khi `categoryId = null`) cho một tháng hoặc mức mặc định.
 * `amount = null` là bỏ mức đó (xóa mềm). Trả về bản ghi thay đổi, hoặc null nếu không
 * có gì thay đổi. Không sửa được mức riêng của tháng đã khóa.
 */
export function setBudget(
  month: string,
  categoryId: string | null,
  amount: number | null,
  ctx: MutationContext,
): Budget | null {
  if (month !== DEFAULT_BUDGET_MONTH) {
    if (!isValidMonth(month)) throw new DomainError('Tháng không hợp lệ.');
    if (isLocked(month, ctx.now, findMonthRecord(ctx.data.months, month))) {
      throw new DomainError(`${formatMonthLabel(month)} đã khóa, không sửa được ngân sách.`);
    }
  }
  if (categoryId !== null && !active(ctx.data.categories).some((c) => c.id === categoryId)) {
    throw new DomainError('Không tìm thấy danh mục.');
  }
  if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)) {
    throw new DomainError('Ngân sách phải là số nguyên yên lớn hơn 0.');
  }

  const existing = findBudget(ctx.data.budgets, month, categoryId);
  if (amount === null) {
    return existing && !existing.deleted ? softDelete(existing, ctx.userId, ctx.now) : null;
  }
  if (!existing) {
    return createRecord<Budget>(
      budgetId(month, categoryId),
      { month, categoryId, amount },
      ctx.userId,
      ctx.now,
    );
  }
  if (!existing.deleted && existing.amount === amount) return null;
  // Đặt lại mức đã bỏ trước đó: cùng id cố định, bỏ trạng thái xóa mềm.
  const { deletedAt, ...rest } = existing;
  return touch({ ...rest, deleted: false }, { amount }, ctx.userId, ctx.now);
}

export interface CategoryBudgetRow {
  categoryId: string;
  spent: number;
  budget: number | null;
  /** null khi danh mục chưa có ngân sách. */
  level: BudgetLevel | null;
}

/**
 * Chi theo danh mục của tháng so với ngân sách: mọi danh mục có chi hoặc có ngân sách,
 * theo thứ tự danh mục. Danh mục đã xóa vẫn hiện nếu còn khoản chi trong tháng.
 */
export function categoryBudgetRows(data: DataFile, month: string): CategoryBudgetRow[] {
  const spent = new Map(
    spendingByCategory(data.transactions, month).map((s) => [s.categoryId, s.amount]),
  );
  return [...data.categories]
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
    .map((category) => {
      const amount = spent.get(category.id) ?? 0;
      const budget = category.deleted ? null : getBudgetAmount(data.budgets, month, category.id);
      return {
        categoryId: category.id,
        spent: amount,
        budget,
        level: budget === null ? null : budgetLevel(amount, budget),
      };
    })
    .filter((row) => row.spent > 0 || row.budget !== null);
}
