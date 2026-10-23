import { describe, expect, it } from 'vitest';
import { unlockMonth } from './monthLock';
import { NOW, makeData, makeTx } from './testing';
import { createTransaction, deleteTransaction, updateTransaction } from './transactions';
import type { MutationContext, TransactionInput } from './types';

function setup() {
  const { data, a, b } = makeData();
  const ctx: MutationContext = { data, userId: a, now: NOW };
  const input: TransactionInput = {
    date: '2026-10-05',
    amount: 12500,
    categoryId: 'cat-grocery',
    note: '  Siêu thị Aeon  ',
    paidBy: b,
  };
  return { data, a, b, ctx, input };
}

describe('createTransaction', () => {
  it('tạo khoản chi, ghi lại người nhập và chuẩn hóa ghi chú', () => {
    const { ctx, input, a, b } = setup();
    const tx = createTransaction(input, ctx, 'tx-new');
    expect(tx).toMatchObject({
      id: 'tx-new',
      date: '2026-10-05',
      amount: 12500,
      categoryId: 'cat-grocery',
      note: 'Siêu thị Aeon',
      paidBy: b,
      createdBy: a,
      updatedBy: a,
      deleted: false,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
  });

  it.each([
    ['số tiền bằng 0', { amount: 0 }],
    ['số tiền âm', { amount: -100 }],
    ['số tiền lẻ', { amount: 12.5 }],
    ['số tiền NaN', { amount: Number.NaN }],
    ['ngày không tồn tại', { date: '2026-02-30' }],
    ['ngày sai định dạng', { date: '5/10/2026' }],
    ['danh mục không tồn tại', { categoryId: 'cat-nope' }],
    ['người trả không tồn tại', { paidBy: 'user-x' }],
  ])('từ chối %s', (_label, patch) => {
    const { ctx, input } = setup();
    expect(() => createTransaction({ ...input, ...patch }, ctx, 'tx')).toThrow();
  });

  it('không thêm được khoản vào tháng đã khóa', () => {
    const { ctx, input } = setup();
    expect(() => createTransaction({ ...input, date: '2026-09-30' }, ctx, 'tx')).toThrow(
      'Tháng 9/2026 đã khóa',
    );
  });

  it('thêm được vào tháng đã khóa khi admin đang mở khóa tạm', () => {
    const { ctx, input, a } = setup();
    ctx.data.months = [unlockMonth([], '2026-09', a, NOW)];
    expect(() => createTransaction({ ...input, date: '2026-09-30' }, ctx, 'tx')).not.toThrow();
  });
});

describe('updateTransaction', () => {
  it('sửa khoản chi, cập nhật updatedAt/updatedBy, giữ createdBy', () => {
    const { ctx, input, b } = setup();
    const existing = makeTx({ date: '2026-10-01', amount: 1000, paidBy: b });
    const later = new Date(NOW.getTime() + 1000);
    const updated = updateTransaction(existing, input, { ...ctx, now: later });
    expect(updated).toMatchObject({
      id: existing.id,
      amount: 12500,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: later.toISOString(),
      updatedBy: ctx.userId,
    });
  });

  it('không sửa được khoản thuộc tháng đã khóa', () => {
    const { ctx, input, b } = setup();
    const existing = makeTx({ date: '2026-09-15', amount: 1000, paidBy: b });
    expect(() => updateTransaction(existing, input, ctx)).toThrow('Tháng 9/2026 đã khóa');
  });

  it('không đổi được ngày của khoản khác sang tháng đã khóa', () => {
    const { ctx, input, b } = setup();
    const existing = makeTx({ date: '2026-10-01', amount: 1000, paidBy: b });
    expect(() => updateTransaction(existing, { ...input, date: '2026-09-30' }, ctx)).toThrow(
      'Tháng 9/2026 đã khóa',
    );
  });

  it('không sửa được khoản đã xóa', () => {
    const { ctx, input, b } = setup();
    const existing = makeTx({ date: '2026-10-01', amount: 1000, paidBy: b, deleted: true });
    expect(() => updateTransaction(existing, input, ctx)).toThrow('đã bị xóa');
  });
});

describe('deleteTransaction', () => {
  it('xóa mềm: giữ bản ghi, đặt deleted, deletedAt và updatedAt', () => {
    const { ctx, b } = setup();
    const existing = makeTx({ date: '2026-10-01', amount: 1000, paidBy: b });
    const deleted = deleteTransaction(existing, ctx);
    expect(deleted).toMatchObject({
      id: existing.id,
      amount: 1000,
      deleted: true,
      deletedAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      updatedBy: ctx.userId,
    });
  });

  it('không xóa được khoản thuộc tháng đã khóa', () => {
    const { ctx, b } = setup();
    const existing = makeTx({ date: '2026-09-15', amount: 1000, paidBy: b });
    expect(() => deleteTransaction(existing, ctx)).toThrow('Tháng 9/2026 đã khóa');
  });
});
