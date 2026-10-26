import { DomainError } from './errors';
import { isValidMonth } from './month';
import { active, createRecord, softDelete, touch } from './records';
import { spendingByCategory } from './queries';
import type { Budget, DataFile, MutationContext, RecurringTemplate } from './types';

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
 * có gì thay đổi.
 */
export function setBudget(
  month: string,
  categoryId: string | null,
  amount: number | null,
  ctx: MutationContext,
): Budget | null {
  if (month !== DEFAULT_BUDGET_MONTH && !isValidMonth(month)) {
    throw new DomainError('Tháng không hợp lệ.');
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

/** Tổng số tiền các mẫu định kỳ đang bật, theo danh mục. */
export function recurringTotals(templates: readonly RecurringTemplate[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const template of active(templates)) {
    if (!template.active) continue;
    totals.set(template.categoryId, (totals.get(template.categoryId) ?? 0) + template.amount);
  }
  return totals;
}

/**
 * Danh mục có khoản định kỳ đang bật lấy ngân sách (mức chung mọi tháng) bằng đúng tổng các
 * khoản đó; muốn đổi thì sửa ở màn Định kỳ, không nhập tay. Gọi mỗi khi danh sách mẫu đổi từ
 * `before` sang `after`: danh mục còn khoản định kỳ thì đặt mức bằng tổng mới, danh mục vừa hết
 * khoản định kỳ (tắt hoặc xóa hết) thì bỏ mức và quay về nhập tay. Không đụng ngân sách tổng.
 * Trả về các bản ghi ngân sách thay đổi.
 */
export function applyRecurringToBudgets(
  before: readonly RecurringTemplate[],
  after: readonly RecurringTemplate[],
  ctx: MutationContext,
): Budget[] {
  const next = recurringTotals(after);
  const changed: Budget[] = [];
  for (const categoryId of new Set([...recurringTotals(before).keys(), ...next.keys()])) {
    if (!active(ctx.data.categories).some((c) => c.id === categoryId)) continue;
    const record = setBudget(DEFAULT_BUDGET_MONTH, categoryId, next.get(categoryId) ?? null, ctx);
    if (record) changed.push(record);
  }
  return changed;
}

/** Ngân sách nhập tay. Danh mục có khoản định kỳ đang bật thì không nhập tay được. */
export function setManualBudget(
  month: string,
  categoryId: string | null,
  amount: number | null,
  ctx: MutationContext,
): Budget | null {
  if (categoryId !== null && recurringTotals(ctx.data.recurring).has(categoryId)) {
    throw new DomainError(
      'Ngân sách của danh mục này bằng tổng khoản định kỳ, sửa ở màn hình Định kỳ.',
    );
  }
  return setBudget(month, categoryId, amount, ctx);
}
