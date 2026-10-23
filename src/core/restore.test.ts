import { describe, expect, it } from 'vitest';
import { merge } from './merge';
import { upsert } from './records';
import { planRestore, summarizeData } from './restore';
import { NOW, makeData, makeTx } from './testing';
import { deleteTransaction, updateTransaction } from './transactions';
import type { DataFile, Transaction } from './types';

function at(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

/** Snapshot lúc đầu có 2 khoản; sau đó dữ liệu bị sửa, xóa, thêm. */
function scenario() {
  const { data, a } = makeData();
  const kept = makeTx({ id: 'tx-kept', date: '2026-10-01', amount: 1000, paidBy: a });
  const edited = makeTx({ id: 'tx-edited', date: '2026-10-02', amount: 2000, paidBy: a });
  const snapshot: DataFile = { ...data, transactions: [kept, edited] };

  const ctx = (minutes: number) => ({ data: current, userId: a, now: at(minutes) });
  let current: DataFile = snapshot;
  const change = (tx: Transaction) => {
    current = { ...current, transactions: upsert(current.transactions, tx) };
  };
  change(
    updateTransaction(
      edited,
      { date: '2026-10-02', amount: 9999, categoryId: 'cat-grocery', note: 'sửa nhầm', paidBy: a },
      ctx(1),
    ),
  );
  change(deleteTransaction(kept, ctx(2)));
  change(makeTx({ id: 'tx-added', date: '2026-10-03', amount: 3000, paidBy: a }));
  return { snapshot, current, a };
}

function find(data: DataFile, id: string) {
  return data.transactions.find((t) => t.id === id);
}

describe('planRestore', () => {
  it('đưa dữ liệu về đúng như snapshot', () => {
    const { snapshot, current, a } = scenario();
    const { data, rewritten, removed } = planRestore(current, snapshot, a, at(10));

    expect(find(data, 'tx-kept')).toMatchObject({ deleted: false, amount: 1000 });
    expect(find(data, 'tx-edited')).toMatchObject({ amount: 2000, note: '' });
    expect(find(data, 'tx-added')).toMatchObject({ deleted: true });
    expect(rewritten).toBe(2);
    expect(removed).toBe(1);
  });

  it('bản ghi thay đổi mang updatedAt = bây giờ; bản ghi không đổi giữ nguyên', () => {
    const { snapshot, current, a } = scenario();
    const { data } = planRestore(current, snapshot, a, at(10));
    expect(find(data, 'tx-edited')?.updatedAt).toBe(at(10).toISOString());
    expect(find(data, 'tx-added')?.updatedAt).toBe(at(10).toISOString());
    expect(data.categories).toEqual(current.categories);
  });

  it('máy kia còn dữ liệu mới hơn snapshot → sau merge bản khôi phục vẫn thắng', () => {
    const { snapshot, current, a } = scenario();
    const otherMachine = { ...structuredClone(current), deviceId: 'device-b' };
    const restored = planRestore(current, snapshot, a, at(10)).data;

    for (const merged of [merge(otherMachine, restored), merge(restored, otherMachine)]) {
      expect(find(merged, 'tx-kept')).toMatchObject({ deleted: false, amount: 1000 });
      expect(find(merged, 'tx-edited')).toMatchObject({ amount: 2000 });
      expect(find(merged, 'tx-added')?.deleted).toBe(true);
    }
  });

  it('khôi phục bản backup của gia đình khác → báo lỗi', () => {
    const { snapshot, current, a } = scenario();
    const other = { ...snapshot, users: snapshot.users.map((u) => ({ ...u, id: `x-${u.id}` })) };
    expect(() => planRestore(current, other, a, at(10))).toThrow('gia đình khác');
  });
});

describe('summarizeData', () => {
  it('đếm khoản chi chưa xóa và khoảng ngày', () => {
    const { current } = scenario();
    expect(summarizeData(current)).toEqual({
      transactions: 2,
      firstDate: '2026-10-02',
      lastDate: '2026-10-03',
    });
  });

  it('chưa có khoản nào', () => {
    expect(summarizeData(makeData().data)).toEqual({
      transactions: 0,
      firstDate: null,
      lastDate: null,
    });
  });
});
