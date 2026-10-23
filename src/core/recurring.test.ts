import { describe, expect, it } from 'vitest';
import { merge } from './merge';
import { upsert } from './records';
import {
  createRecurring,
  deleteRecurring,
  generateRecurring,
  recurringTransactionId,
  updateRecurring,
  type RecurringInput,
} from './recurring';
import { NOW, localTime, makeData } from './testing';
import { deleteTransaction } from './transactions';
import type { DataFile, MutationContext } from './types';

const RENT: RecurringInput = {
  name: 'Tiền nhà',
  amount: 85000,
  categoryId: 'cat-rent',
  paidBy: 'user-a',
  dayOfMonth: 25,
  startMonth: '2026-09',
  active: true,
};

function setup(input: Partial<RecurringInput> = {}) {
  const { data, a, b } = makeData();
  const ctx: MutationContext = { data, userId: a, now: NOW };
  const template = createRecurring({ ...RENT, ...input }, ctx, 'rent');
  const withTemplate: DataFile = { ...data, recurring: [template] };
  return { data: withTemplate, a, b, template };
}

describe('generateRecurring', () => {
  it('sinh khoản cho tháng hiện tại với id cố định và ngày theo mẫu', () => {
    const { data, a } = setup();
    expect(generateRecurring(data, NOW)).toEqual([
      expect.objectContaining({
        id: 'rec-rent-2026-10',
        date: '2026-10-25',
        amount: 85000,
        categoryId: 'cat-rent',
        note: 'Tiền nhà',
        paidBy: 'user-a',
        createdBy: a,
        recurringId: 'rent',
        deleted: false,
      }),
    ]);
  });

  it('ngày 1–9 được thêm số 0 phía trước', () => {
    const { data } = setup({ dayOfMonth: 5 });
    expect(generateRecurring(data, NOW)[0]?.date).toBe('2026-10-05');
  });

  it('đã có khoản của tháng này → không sinh thêm', () => {
    const { data } = setup();
    const generated = generateRecurring(data, NOW);
    expect(generateRecurring({ ...data, transactions: generated }, NOW)).toEqual([]);
  });

  it('người dùng đã xóa khoản định kỳ tháng này → không sinh lại', () => {
    const { data, a } = setup();
    const [tx] = generateRecurring(data, NOW);
    const deleted = deleteTransaction(tx!, { data, userId: a, now: NOW });
    expect(generateRecurring({ ...data, transactions: [deleted] }, NOW)).toEqual([]);
  });

  it('chỉ sinh cho tháng hiện tại, không sinh bù tháng trước', () => {
    const { data } = setup({ startMonth: '2026-01' });
    expect(generateRecurring(data, NOW).map((t) => t.id)).toEqual(['rec-rent-2026-10']);
  });

  it('chưa tới tháng bắt đầu, mẫu đang tắt hoặc đã xóa → không sinh', () => {
    expect(generateRecurring(setup({ startMonth: '2026-11' }).data, NOW)).toEqual([]);
    expect(generateRecurring(setup({ active: false }).data, NOW)).toEqual([]);
    const { data, template, a } = setup();
    const removed = deleteRecurring(template, { data, userId: a, now: NOW });
    expect(generateRecurring({ ...data, recurring: [removed] }, NOW)).toEqual([]);
  });

  it('sang tháng mới thì sinh khoản của tháng mới', () => {
    const { data } = setup();
    const october = generateRecurring(data, NOW);
    const november = generateRecurring(
      { ...data, transactions: october },
      localTime(2026, 11, 1, 0, 5),
    );
    expect(november.map((t) => t.id)).toEqual([recurringTransactionId('rent', '2026-11')]);
  });

  it('cả hai máy cùng sinh → sau merge chỉ còn một khoản', () => {
    const { data } = setup();
    const onA = { ...data, transactions: generateRecurring(data, NOW) };
    const later = new Date(NOW.getTime() + 30_000);
    const onB = { ...data, deviceId: 'device-b', transactions: generateRecurring(data, later) };
    expect(merge(onA, onB).transactions).toHaveLength(1);
  });
});

describe('createRecurring / updateRecurring', () => {
  it.each([
    ['tên trống', { name: '  ' }],
    ['số tiền lẻ', { amount: 10.5 }],
    ['ngày 29', { dayOfMonth: 29 }],
    ['ngày 0', { dayOfMonth: 0 }],
    ['danh mục không tồn tại', { categoryId: 'cat-x' }],
    ['người trả không tồn tại', { paidBy: 'user-x' }],
    ['tháng bắt đầu sai', { startMonth: '2026-13' }],
  ])('từ chối %s', (_label, patch) => {
    const { data, a } = makeData();
    expect(() =>
      createRecurring({ ...RENT, ...patch }, { data, userId: a, now: NOW }, 'x'),
    ).toThrow();
  });

  it('sửa mẫu cập nhật updatedAt, giữ id', () => {
    const { data, a, template } = setup();
    const later = new Date(NOW.getTime() + 1000);
    const updated = updateRecurring(
      template,
      { ...RENT, amount: 90000 },
      { data, userId: a, now: later },
    );
    expect(updated).toMatchObject({ id: 'rent', amount: 90000, updatedAt: later.toISOString() });
  });

  it('khoản sinh từ mẫu ghi người nhập là người sửa mẫu gần nhất', () => {
    const { data, b, template } = setup();
    const byB = updateRecurring(template, RENT, { data, userId: b, now: NOW });
    const [tx] = generateRecurring({ ...data, recurring: upsert(data.recurring, byB) }, NOW);
    expect(tx).toMatchObject({ createdBy: b, updatedBy: b });
  });
});
