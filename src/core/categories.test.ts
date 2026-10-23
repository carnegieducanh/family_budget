import { describe, expect, it } from 'vitest';
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  setCategoryHidden,
  sortedCategories,
  updateCategory,
} from './categories';
import { upsert } from './records';
import { NOW, makeData, makeTx } from './testing';
import type { Category, MutationContext } from './types';

function setup() {
  const { data, a } = makeData();
  const ctx: MutationContext = { data, userId: a, now: NOW };
  const find = (id: string) => data.categories.find((c) => c.id === id) as Category;
  return { data, a, ctx, find };
}

describe('createCategory', () => {
  it('thêm vào cuối danh sách', () => {
    const { ctx } = setup();
    const category = createCategory({ name: '  Học   phí ', icon: '📚' }, ctx, 'cat-new');
    expect(category).toMatchObject({ id: 'cat-new', name: 'Học phí', icon: '📚', order: 13 });
    expect(category.hidden).toBe(false);
  });

  it('từ chối tên trống, thiếu icon, tên trùng (không phân biệt hoa thường)', () => {
    const { ctx } = setup();
    expect(() => createCategory({ name: ' ', icon: '📚' }, ctx, 'x')).toThrow('tên');
    expect(() => createCategory({ name: 'Học phí', icon: '' }, ctx, 'x')).toThrow('icon');
    expect(() => createCategory({ name: 'ĂN NGOÀI', icon: '🍜' }, ctx, 'x')).toThrow('Đã có');
  });
});

describe('updateCategory', () => {
  it('đổi tên và icon', () => {
    const { ctx, find } = setup();
    const updated = updateCategory(find('cat-other'), { name: 'Linh tinh', icon: '🧩' }, ctx);
    expect(updated).toMatchObject({ id: 'cat-other', name: 'Linh tinh', icon: '🧩', order: 12 });
  });

  it('giữ nguyên tên của chính nó không bị coi là trùng', () => {
    const { ctx, find } = setup();
    expect(() =>
      updateCategory(find('cat-other'), { name: 'khác', icon: '📦' }, ctx),
    ).not.toThrow();
  });
});

describe('ẩn và xóa danh mục', () => {
  it('ẩn rồi hiện lại', () => {
    const { ctx, find } = setup();
    const hidden = setCategoryHidden(find('cat-gifts'), true, ctx);
    expect(hidden.hidden).toBe(true);
    expect(setCategoryHidden(hidden, false, ctx).hidden).toBe(false);
  });

  it('danh mục chưa dùng thì xóa mềm được', () => {
    const { ctx, find } = setup();
    expect(deleteCategory(find('cat-gifts'), ctx)).toMatchObject({ deleted: true });
  });

  it('danh mục đã có khoản chi (kể cả khoản đã xóa) thì không xóa được', () => {
    const { ctx, find, a } = setup();
    const tx = makeTx({
      date: '2026-10-01',
      amount: 100,
      paidBy: a,
      categoryId: 'cat-gifts',
      deleted: true,
    });
    const used = { ...ctx, data: { ...ctx.data, transactions: [tx] } };
    expect(() => deleteCategory(find('cat-gifts'), used)).toThrow('chỉ ẩn được');
  });
});

describe('reorderCategories', () => {
  it('đổi thứ tự, chỉ trả về các danh mục có thứ tự thay đổi', () => {
    const { ctx } = setup();
    const ids = sortedCategories(ctx.data.categories).map((c) => c.id);
    // Kéo "Khác" (cuối) lên đầu.
    const moved = ['cat-other', ...ids.filter((id) => id !== 'cat-other')];
    const changed = reorderCategories(moved, ctx);
    expect(changed).toHaveLength(12);
    const next = changed.reduce((list, c) => upsert(list, c), ctx.data.categories);
    expect(sortedCategories(next).map((c) => c.id)).toEqual(moved);
  });

  it('đổi chỗ hai danh mục kề nhau chỉ sửa 2 bản ghi', () => {
    const { ctx } = setup();
    const ids = sortedCategories(ctx.data.categories).map((c) => c.id);
    const swapped = [ids[1], ids[0], ...ids.slice(2)] as string[];
    expect(reorderCategories(swapped, ctx).map((c) => c.id)).toEqual([ids[1], ids[0]]);
  });
});
