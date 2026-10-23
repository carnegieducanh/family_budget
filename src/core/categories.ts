import { DomainError } from './errors';
import { active, createRecord, softDelete, touch } from './records';
import type { Category, DataFile, MutationContext } from './types';

// Quản lý danh mục (SPEC mục 8, màn hình 7). Danh mục đã dùng chỉ được ẩn, không xóa.

export interface CategoryInput {
  name: string;
  icon: string;
}

/** Danh mục chưa xóa, theo thứ tự hiển thị. */
export function sortedCategories(categories: readonly Category[]): Category[] {
  return active(categories).sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
}

/** Tên danh mục dùng để so khớp: bỏ khoảng trắng thừa, không phân biệt hoa thường. */
export function categoryKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

export function validateCategoryInput(
  input: CategoryInput,
  categories: readonly Category[],
  exceptId?: string,
): CategoryInput {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const icon = input.icon.trim();
  if (!name) throw new DomainError('Hãy nhập tên danh mục.');
  if (name.length > 40) throw new DomainError('Tên danh mục tối đa 40 ký tự.');
  if (!icon) throw new DomainError('Hãy chọn icon cho danh mục.');
  if (icon.length > 8) throw new DomainError('Icon chỉ nên là một emoji.');
  // Tên không trùng, để import CSV khớp danh mục theo tên mà không nhầm.
  const key = categoryKey(name);
  if (active(categories).some((c) => c.id !== exceptId && categoryKey(c.name) === key)) {
    throw new DomainError(`Đã có danh mục tên "${name}".`);
  }
  return { name, icon };
}

export function createCategory(input: CategoryInput, ctx: MutationContext, id: string): Category {
  const clean = validateCategoryInput(input, ctx.data.categories);
  const order = Math.max(0, ...active(ctx.data.categories).map((c) => c.order)) + 1;
  return createRecord<Category>(id, { ...clean, order, hidden: false }, ctx.userId, ctx.now);
}

export function updateCategory(
  existing: Category,
  input: CategoryInput,
  ctx: MutationContext,
): Category {
  if (existing.deleted) throw new DomainError('Danh mục này đã bị xóa.');
  const clean = validateCategoryInput(input, ctx.data.categories, existing.id);
  return touch(existing, clean, ctx.userId, ctx.now);
}

export function setCategoryHidden(
  existing: Category,
  hidden: boolean,
  ctx: MutationContext,
): Category {
  if (existing.deleted) throw new DomainError('Danh mục này đã bị xóa.');
  return touch(existing, { hidden }, ctx.userId, ctx.now);
}

/** Danh mục đã có khoản chi (kể cả khoản đã xóa) hoặc chi tiêu định kỳ dùng tới. */
export function isCategoryUsed(data: DataFile, categoryId: string): boolean {
  return (
    data.transactions.some((t) => t.categoryId === categoryId) ||
    active(data.recurring).some((r) => r.categoryId === categoryId)
  );
}

/** Xóa mềm danh mục chưa từng dùng; danh mục đã dùng chỉ được ẩn. */
export function deleteCategory(existing: Category, ctx: MutationContext): Category {
  if (existing.deleted) throw new DomainError('Danh mục này đã bị xóa.');
  if (isCategoryUsed(ctx.data, existing.id)) {
    throw new DomainError('Danh mục đã có khoản chi nên không xóa được, chỉ ẩn được.');
  }
  return softDelete(existing, ctx.userId, ctx.now);
}

/**
 * Sắp xếp lại theo danh sách id (kéo thả). Trả về các danh mục có thứ tự thay đổi;
 * danh mục không có trong danh sách giữ nguyên vị trí tương đối ở cuối.
 */
export function reorderCategories(orderedIds: readonly string[], ctx: MutationContext): Category[] {
  const current = sortedCategories(ctx.data.categories);
  const byId = new Map(current.map((c) => [c.id, c]));
  const ordered = [
    ...orderedIds.map((id) => byId.get(id)).filter((c): c is Category => c !== undefined),
    ...current.filter((c) => !orderedIds.includes(c.id)),
  ];
  return ordered
    .map((category, index) => ({ category, order: index + 1 }))
    .filter(({ category, order }) => category.order !== order)
    .map(({ category, order }) => touch(category, { order }, ctx.userId, ctx.now));
}
