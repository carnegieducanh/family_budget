import { describe, expect, it } from 'vitest';
import {
  applyRecurringToBudgets,
  budgetId,
  budgetLevel,
  categoryBudgetRows,
  getBudgetAmount,
  setBudget,
  setManualBudget,
} from './budget';
import { upsert } from './records';
import { createRecurring, deleteRecurring, type RecurringInput } from './recurring';
import { NOW, makeData, makeTx } from './testing';
import type { Budget, MutationContext, RecurringTemplate } from './types';

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

describe('setBudget', () => {
  function setup() {
    const { data, a } = makeData();
    const ctx: MutationContext = { data, userId: a, now: NOW };
    return { data, a, ctx };
  }

  it('đặt ngân sách tổng mặc định và theo danh mục của tháng, id cố định', () => {
    const { ctx } = setup();
    expect(setBudget('default', null, 300000, ctx)).toMatchObject({
      id: 'budget-default-total',
      month: 'default',
      categoryId: null,
      amount: 300000,
    });
    expect(setBudget('2026-10', 'cat-grocery', 60000, ctx)).toMatchObject({
      id: 'budget-2026-10-cat-grocery',
    });
  });

  it('bỏ mức đã đặt (xóa mềm), đặt lại thì dùng lại bản ghi cũ', () => {
    const { ctx } = setup();
    const set = setBudget('default', null, 300000, ctx) as Budget;
    const withBudget = { ...ctx, data: { ...ctx.data, budgets: [set] } };
    const removed = setBudget('default', null, null, withBudget) as Budget;
    expect(removed).toMatchObject({ deleted: true });
    expect(getBudgetAmount([removed], '2026-10', null)).toBeNull();

    const again = setBudget('default', null, 250000, {
      ...ctx,
      data: { ...ctx.data, budgets: upsert([set], removed) },
    }) as Budget;
    expect(again).toMatchObject({ id: set.id, deleted: false, amount: 250000 });
    expect(again.deletedAt).toBeUndefined();
  });

  it('không đổi gì → null', () => {
    const { ctx } = setup();
    expect(setBudget('default', null, null, ctx)).toBeNull();
    const set = setBudget('default', null, 1000, ctx) as Budget;
    expect(
      setBudget('default', null, 1000, { ...ctx, data: { ...ctx.data, budgets: [set] } }),
    ).toBeNull();
  });

  it('đặt được ngân sách riêng của tháng đã qua', () => {
    const { ctx } = setup();
    expect(setBudget('2026-09', null, 1000, ctx)).toMatchObject({ amount: 1000 });
  });

  it('từ chối số tiền không hợp lệ và danh mục không tồn tại', () => {
    const { ctx } = setup();
    expect(() => setBudget('default', null, 0, ctx)).toThrow('lớn hơn 0');
    expect(() => setBudget('default', null, 10.5, ctx)).toThrow();
    expect(() => setBudget('default', 'cat-x', 100, ctx)).toThrow('danh mục');
  });
});

describe('categoryBudgetRows', () => {
  it('danh mục có chi hoặc có ngân sách, theo thứ tự danh mục, kèm mức cảnh báo', () => {
    const { data, a } = makeData();
    data.budgets = [budget('default', 'cat-grocery', 10000), budget('2026-10', 'cat-rent', 80000)];
    data.transactions = [
      makeTx({ date: '2026-10-01', amount: 9000, paidBy: a, categoryId: 'cat-grocery' }),
      makeTx({ date: '2026-10-02', amount: 1500, paidBy: a, categoryId: 'cat-dining' }),
      makeTx({ date: '2026-09-02', amount: 7000, paidBy: a, categoryId: 'cat-health' }),
    ];
    expect(categoryBudgetRows(data, '2026-10')).toEqual([
      { categoryId: 'cat-grocery', spent: 9000, budget: 10000, level: 'warning' },
      { categoryId: 'cat-dining', spent: 1500, budget: null, level: null },
      { categoryId: 'cat-rent', spent: 0, budget: 80000, level: 'ok' },
    ]);
  });
});

describe('applyRecurringToBudgets', () => {
  const RENT: RecurringInput = {
    name: 'Tiền nhà',
    amount: 80000,
    categoryId: 'cat-rent',
    paidBy: 'user-a',
    dayOfMonth: 25,
    startMonth: '2026-10',
    active: true,
  };
  const { data, a } = makeData();
  const rent = createRecurring(RENT, { data, userId: a, now: NOW }, 'rent');

  /** Áp thay đổi mẫu lên ngân sách; trả về [danh mục, số tiền, đã xóa] của các mức thay đổi. */
  function apply(budgets: Budget[], before: RecurringTemplate[], after: RecurringTemplate[]) {
    const ctx: MutationContext = {
      data: { ...data, budgets, recurring: before },
      userId: a,
      now: NOW,
    };
    return applyRecurringToBudgets(before, after, ctx).map((b) => {
      expect(b.month).toBe('default');
      return [b.categoryId, b.amount, b.deleted];
    });
  }

  it('ngân sách danh mục = tổng các mẫu đang bật, thay cho mức nhập tay trước đó', () => {
    const parking = { ...rent, id: 'parking', amount: 10000 };
    const netflix = { ...rent, id: 'netflix', amount: 1590, categoryId: 'cat-leisure' };
    const unused = { ...rent, id: 'unused', amount: 3000, active: false };
    const budgets = [budget('default', 'cat-leisure', 15000)];
    expect(apply(budgets, [], [rent, parking, netflix, unused])).toEqual([
      ['cat-rent', 90000, false],
      ['cat-leisure', 1590, false],
    ]);
  });

  it('sửa số tiền thì ngân sách theo tổng mới', () => {
    const budgets = [budget('default', 'cat-rent', 80000)];
    expect(apply(budgets, [rent], [{ ...rent, amount: 82000 }])).toEqual([
      ['cat-rent', 82000, false],
    ]);
  });

  it('đổi danh mục thì danh mục cũ bỏ mức, danh mục mới lấy số tiền mẫu', () => {
    const budgets = [budget('default', 'cat-rent', 80000)];
    expect(apply(budgets, [rent], [{ ...rent, categoryId: 'cat-household' }])).toEqual([
      ['cat-rent', 80000, true],
      ['cat-household', 80000, false],
    ]);
  });

  it('tắt hoặc xóa mẫu cuối của danh mục thì bỏ mức; bật lại thì có lại', () => {
    const budgets = [budget('default', 'cat-rent', 80000)];
    const off = { ...rent, active: false };
    const removed = deleteRecurring(rent, { data, userId: a, now: NOW });
    expect(apply(budgets, [rent], [off])).toEqual([['cat-rent', 80000, true]]);
    expect(apply(budgets, [rent], [removed])).toEqual([['cat-rent', 80000, true]]);
    expect(apply([budget('default', 'cat-rent', 80000, true)], [off], [rent])).toEqual([
      ['cat-rent', 80000, false],
    ]);
  });

  it('không đổi số tiền thì không ghi; mẫu đang tắt không đụng mức nhập tay', () => {
    const budgets = [budget('default', 'cat-rent', 80000)];
    const renamed = { ...rent, name: 'Tiền thuê nhà', dayOfMonth: 1, paidBy: 'user-b' };
    expect(apply(budgets, [rent], [renamed])).toEqual([]);
    const off = { ...rent, active: false };
    expect(
      apply([budget('default', 'cat-rent', 5000)], [off], [{ ...off, amount: 90000 }]),
    ).toEqual([]);
  });
});

describe('setManualBudget', () => {
  it('không nhập tay được ngân sách của danh mục có khoản định kỳ đang bật', () => {
    const { data, a } = makeData();
    const ctx = (active: boolean): MutationContext => {
      const rent = createRecurring(
        {
          name: 'Tiền nhà',
          amount: 80000,
          categoryId: 'cat-rent',
          paidBy: a,
          dayOfMonth: 25,
          startMonth: '2026-10',
          active,
        },
        { data, userId: a, now: NOW },
        'rent',
      );
      return { data: { ...data, recurring: [rent] }, userId: a, now: NOW };
    };
    expect(() => setManualBudget('default', 'cat-rent', 90000, ctx(true))).toThrow('Định kỳ');
    expect(setManualBudget('default', 'cat-rent', 90000, ctx(false))?.amount).toBe(90000);
    expect(setManualBudget('default', null, 300000, ctx(true))?.amount).toBe(300000);
    expect(setManualBudget('default', 'cat-grocery', 60000, ctx(true))?.amount).toBe(60000);
  });
});
