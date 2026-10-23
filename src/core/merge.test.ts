import { describe, expect, it } from 'vitest';
import {
  COLLECTIONS,
  compareVersions,
  hasClockSkew,
  merge,
  mergeRecords,
  sameRecords,
} from './merge';
import { softDelete, touch, upsert } from './records';
import { NOW, makeData, makeTx } from './testing';
import { createTransaction, deleteTransaction, updateTransaction } from './transactions';
import type { DataFile, Transaction, TransactionInput } from './types';

/** Thời điểm cách NOW `minutes` phút. */
function at(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

/** Phần dữ liệu được merge (bỏ phần đầu file deviceId, writtenAt). */
function content(data: DataFile) {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, data[name]]));
}

/** Hai máy cùng một gia đình: A (admin, máy device-a) và B (member, máy device-b). */
function twoMachines() {
  const { data, a, b } = makeData();
  const machineA: DataFile = { ...data, deviceId: 'device-a' };
  const machineB: DataFile = { ...structuredClone(data), deviceId: 'device-b' };
  return { machineA, machineB, a, b };
}

const INPUT: TransactionInput = {
  date: '2026-10-05',
  amount: 12500,
  categoryId: 'cat-grocery',
  note: 'Siêu thị',
  paidBy: 'user-a',
};

function addTx(data: DataFile, userId: string, now: Date, id: string, input = INPUT): DataFile {
  const tx = createTransaction(input, { data, userId, now }, id);
  return { ...data, transactions: upsert(data.transactions, tx) };
}

function editTx(data: DataFile, userId: string, now: Date, id: string, input: TransactionInput) {
  const existing = data.transactions.find((t) => t.id === id) as Transaction;
  const tx = updateTransaction(existing, input, { data, userId, now });
  return { ...data, transactions: upsert(data.transactions, tx) };
}

function removeTx(data: DataFile, userId: string, now: Date, id: string): DataFile {
  const existing = data.transactions.find((t) => t.id === id) as Transaction;
  const tx = deleteTransaction(existing, { data, userId, now });
  return { ...data, transactions: upsert(data.transactions, tx) };
}

function findTx(data: DataFile, id: string): Transaction | undefined {
  return data.transactions.find((t) => t.id === id);
}

describe('merge', () => {
  it('bản ghi chỉ có ở một bên được giữ nguyên', () => {
    const { machineA, machineB, a, b } = twoMachines();
    const localA = addTx(machineA, a, at(1), 'tx-from-a');
    const localB = addTx(machineB, b, at(2), 'tx-from-b', { ...INPUT, amount: 800, paidBy: b });

    const merged = merge(localA, localB);
    expect(findTx(merged, 'tx-from-a')).toEqual(findTx(localA, 'tx-from-a'));
    expect(findTx(merged, 'tx-from-b')).toEqual(findTx(localB, 'tx-from-b'));
    expect(merged.categories).toHaveLength(12);
    expect(merged.users).toHaveLength(2);
  });

  it('cùng bản ghi sửa ở hai bên → bản có updatedAt mới hơn thắng, cả bản ghi', () => {
    const { machineA, machineB, a, b } = twoMachines();
    const shared = addTx(machineA, a, at(0), 'tx-1');
    const onB = { ...machineB, transactions: shared.transactions };

    const editedA = editTx(shared, a, at(5), 'tx-1', { ...INPUT, amount: 2000, note: 'A sửa' });
    const editedB = editTx(onB, b, at(3), 'tx-1', { ...INPUT, categoryId: 'cat-dining' });

    for (const merged of [merge(editedA, editedB), merge(editedB, editedA)]) {
      // Không gộp từng trường: lấy nguyên bản của A, kể cả categoryId cũ.
      expect(findTx(merged, 'tx-1')).toMatchObject({
        amount: 2000,
        note: 'A sửa',
        categoryId: 'cat-grocery',
        updatedBy: a,
      });
    }
  });

  it('A xóa sau khi B sửa → kết quả là đã xóa', () => {
    const { machineA, machineB, a, b } = twoMachines();
    const shared = addTx(machineA, a, at(0), 'tx-1');
    const editedB = editTx({ ...machineB, transactions: shared.transactions }, b, at(1), 'tx-1', {
      ...INPUT,
      amount: 999,
    });
    const deletedA = removeTx(shared, a, at(2), 'tx-1');

    expect(findTx(merge(deletedA, editedB), 'tx-1')).toMatchObject({ deleted: true });
    expect(findTx(merge(editedB, deletedA), 'tx-1')).toMatchObject({ deleted: true });
  });

  it('B sửa sau khi A xóa → bản của B thắng', () => {
    const { machineA, machineB, a, b } = twoMachines();
    const shared = addTx(machineA, a, at(0), 'tx-1');
    const deletedA = removeTx(shared, a, at(1), 'tx-1');
    const editedB = editTx({ ...machineB, transactions: shared.transactions }, b, at(2), 'tx-1', {
      ...INPUT,
      amount: 999,
    });

    expect(findTx(merge(deletedA, editedB), 'tx-1')).toMatchObject({ deleted: false, amount: 999 });
    expect(findTx(merge(editedB, deletedA), 'tx-1')).toMatchObject({ deleted: false, amount: 999 });
  });

  it('khoản đã xóa ở A không sống lại từ bản cũ của B', () => {
    const { machineA, machineB, a } = twoMachines();
    const shared = addTx(machineA, a, at(0), 'tx-1');
    const oldB = { ...machineB, transactions: shared.transactions };
    const deletedA = removeTx(shared, a, at(1), 'tx-1');

    const onB = merge(oldB, deletedA);
    expect(findTx(onB, 'tx-1')?.deleted).toBe(true);
    expect(findTx(merge(deletedA, onB), 'tx-1')?.deleted).toBe(true);
  });

  it('updatedAt bằng nhau → bản có updatedBy đứng trước theo chữ cái thắng, ở cả hai máy', () => {
    const { machineA, machineB, a, b } = twoMachines();
    const shared = addTx(machineA, a, at(0), 'tx-1');
    const sameTime = at(5);
    const editedA = editTx(shared, a, sameTime, 'tx-1', { ...INPUT, amount: 1111 });
    const editedB = editTx(
      { ...machineB, transactions: shared.transactions },
      b,
      sameTime,
      'tx-1',
      {
        ...INPUT,
        amount: 2222,
      },
    );

    const onA = merge(editedA, editedB);
    const onB = merge(editedB, editedA);
    expect(content(onA)).toEqual(content(onB));
    expect(findTx(onA, 'tx-1')).toMatchObject({ amount: 1111, updatedBy: 'user-a' });
  });

  it('updatedAt và updatedBy đều bằng nhau → hai máy vẫn chọn cùng một bản', () => {
    const base = makeTx({ id: 'tx-1', date: '2026-10-05', amount: 100, paidBy: 'user-a' });
    const one = { ...base, amount: 300 };
    const two = { ...base, amount: 200 };
    expect(mergeRecords([one], [two])).toEqual(mergeRecords([two], [one]));
    expect(compareVersions(one, two)).toBe(-compareVersions(two, one));
  });

  it('khoản định kỳ sinh ở cả hai máy → chỉ còn một', () => {
    const { machineA, machineB, a, b } = twoMachines();
    const recurringId = 'rent-template';
    const id = `rec-${recurringId}-2026-10`;
    const input = { ...INPUT, date: '2026-10-01', amount: 85000, categoryId: 'cat-rent' };
    const withRecurring = (data: DataFile, userId: string, now: Date) => {
      const tx = { ...createTransaction(input, { data, userId, now }, id), recurringId };
      return { ...data, transactions: upsert(data.transactions, tx) };
    };
    const onA = withRecurring(machineA, a, at(0));
    const onB = withRecurring(machineB, b, at(0.01));

    const merged = merge(onA, onB);
    expect(merged.transactions.filter((t) => t.recurringId === recurringId)).toHaveLength(1);
    expect(content(merge(onB, onA))).toEqual(content(merged));
  });

  it('merge(a, b) và merge(b, a) cho cùng kết quả; merge thêm lần nữa không đổi', () => {
    const { machineA, machineB, a, b } = twoMachines();
    let onA = addTx(machineA, a, at(1), 'tx-1');
    onA = addTx(onA, a, at(2), 'tx-2');
    let onB = addTx(machineB, b, at(3), 'tx-3', { ...INPUT, paidBy: b });
    onB = { ...onB, transactions: upsert(onB.transactions, findTx(onA, 'tx-1') as Transaction) };
    onB = editTx(onB, b, at(4), 'tx-1', { ...INPUT, amount: 4444 });
    onA = removeTx(onA, a, at(5), 'tx-2');

    const ab = merge(onA, onB);
    const ba = merge(onB, onA);
    expect(content(ab)).toEqual(content(ba));
    expect(merge(ab, onB)).toEqual(ab);
    expect(merge(ab, onA)).toEqual(ab);
    expect(merge(ab, ab)).toEqual(ab);
  });

  it('giữ phần đầu file của local', () => {
    const { machineA, machineB } = twoMachines();
    const merged = merge(machineA, machineB);
    expect(merged.deviceId).toBe('device-a');
    expect(merged.writtenAt).toBe(machineA.writtenAt);
    expect(merged.schemaVersion).toBe(1);
  });
});

describe('merge — kiểm tra với dữ liệu ngẫu nhiên', () => {
  // Bộ sinh số giả ngẫu nhiên có seed để test luôn lặp lại được.
  function random(seed: number) {
    let state = seed;
    return (max: number) => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state % max;
    };
  }

  function randomMachine(seed: number, deviceId: string): DataFile {
    const pick = random(seed);
    const { data } = makeData();
    const transactions: Transaction[] = [];
    for (let i = 0; i < 12; i++) {
      if (pick(3) === 0) continue; // máy này không có bản ghi đó
      let tx = makeTx({
        id: `tx-${pick(8)}`,
        date: '2026-10-05',
        amount: 100 * (1 + pick(5)),
        paidBy: pick(2) ? 'user-a' : 'user-b',
      });
      const editor = pick(2) ? 'user-a' : 'user-b';
      const when = at(pick(4)); // nhiều bản ghi trùng updatedAt
      tx = pick(4) === 0 ? softDelete(tx, editor, when) : touch(tx, {}, editor, when);
      transactions.push(tx);
    }
    return { ...data, deviceId, transactions };
  }

  it('giao hoán, lũy đẳng và kết hợp trên 200 bộ dữ liệu', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const x = randomMachine(seed, 'device-x');
      const y = randomMachine(seed * 7 + 3, 'device-y');
      const z = randomMachine(seed * 13 + 5, 'device-z');
      const xy = merge(x, y);
      expect(content(xy)).toEqual(content(merge(y, x)));
      expect(merge(xy, y)).toEqual(xy);
      expect(merge(xy, x)).toEqual(xy);
      expect(content(merge(xy, z))).toEqual(content(merge(x, merge(y, z))));
    }
  });
});

describe('sameRecords', () => {
  it('không xét thứ tự bản ghi và thứ tự trường', () => {
    const { data, a } = makeData();
    const tx1 = makeTx({ date: '2026-10-01', amount: 100, paidBy: a });
    const tx2 = makeTx({ date: '2026-10-02', amount: 200, paidBy: a });
    const reordered = Object.fromEntries(Object.entries(tx1).reverse()) as unknown as Transaction;
    expect(
      sameRecords(
        { ...data, transactions: [tx1, tx2] },
        { ...data, transactions: [tx2, reordered], writtenAt: 'khác' },
      ),
    ).toBe(true);
  });

  it('phát hiện bản ghi khác hoặc thiếu', () => {
    const { data, a } = makeData();
    const tx = makeTx({ date: '2026-10-01', amount: 100, paidBy: a });
    const withTx = { ...data, transactions: [tx] };
    expect(sameRecords(withTx, data)).toBe(false);
    expect(sameRecords(withTx, { ...data, transactions: [{ ...tx, amount: 101 }] })).toBe(false);
  });
});

describe('hasClockSkew', () => {
  it('bản ghi remote vượt giờ máy này quá 5 phút → lệch giờ', () => {
    const { data, a } = makeData();
    const remote = { ...data, writtenAt: NOW.toISOString() };
    const tx = (minutes: number) =>
      makeTx({ date: '2026-10-01', amount: 100, paidBy: a, updatedAt: at(minutes).toISOString() });
    expect(hasClockSkew({ ...remote, transactions: [tx(4)] }, NOW)).toBe(false);
    expect(hasClockSkew({ ...remote, transactions: [tx(6)] }, NOW)).toBe(true);
  });

  it('thời điểm ghi file vượt quá 5 phút → lệch giờ', () => {
    const { data } = makeData();
    expect(hasClockSkew({ ...data, writtenAt: at(10).toISOString() }, NOW)).toBe(true);
    expect(hasClockSkew({ ...data, writtenAt: at(-60).toISOString() }, NOW)).toBe(false);
  });
});
