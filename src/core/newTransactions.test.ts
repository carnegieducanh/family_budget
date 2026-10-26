import { describe, expect, it } from 'vitest';
import {
  NOTHING_SEEN,
  initialSeenMark,
  newTransactionsFromOther,
  seenMarkAfter,
} from './newTransactions';
import { makeData, makeTx } from './testing';
import type { DataFile, Transaction } from './types';

const A = 'user-a';
const B = 'user-b';

function withTransactions(transactions: Transaction[]): DataFile {
  return { ...makeData().data, transactions };
}

/** Khoản B tự nhập lúc `createdAt`. */
function byB(id: string, date: string, createdAt: string, fields: Partial<Transaction> = {}) {
  return makeTx({ id, date, amount: 1000, paidBy: B, createdAt, updatedAt: createdAt, ...fields });
}

describe('newTransactionsFromOther', () => {
  it('lấy khoản người kia nhập sau mốc, ngày mới nhất trước', () => {
    const data = withTransactions([
      byB('old', '2026-10-01', '2026-10-01T09:00:00.000Z'),
      byB('new1', '2026-10-20', '2026-10-25T09:00:00.000Z'),
      byB('new2', '2026-10-24', '2026-10-25T10:00:00.000Z'),
    ]);
    const ids = newTransactionsFromOther(data, A, '2026-10-24T00:00:00.000Z').map((t) => t.id);
    expect(ids).toEqual(['new2', 'new1']);
  });

  it('bỏ qua khoản của mình, khoản đã xóa và khoản sinh từ định kỳ', () => {
    const at = '2026-10-25T09:00:00.000Z';
    const data = withTransactions([
      makeTx({ id: 'mine', date: '2026-10-25', amount: 500, paidBy: A, createdAt: at }),
      byB('deleted', '2026-10-25', at, { deleted: true, deletedAt: at }),
      byB('recurring', '2026-10-05', at, { recurringId: 'r1' }),
      byB('kept', '2026-10-25', at),
    ]);
    expect(newTransactionsFromOther(data, A, NOTHING_SEEN).map((t) => t.id)).toEqual(['kept']);
  });

  it('bỏ qua khoản người kia nhập nhưng máy này đã sửa, hoặc nhập từ CSV thay người kia', () => {
    const data = withTransactions([
      byB('edited-here', '2026-10-25', '2026-10-25T09:00:00.000Z', { updatedBy: A }),
      byB('edited-by-b', '2026-10-25', '2026-10-25T09:00:00.000Z', {
        updatedAt: '2026-10-25T11:00:00.000Z',
      }),
    ]);
    expect(newTransactionsFromOther(data, A, NOTHING_SEEN).map((t) => t.id)).toEqual([
      'edited-by-b',
    ]);
  });
});

describe('initialSeenMark', () => {
  it('là thời điểm nhập của khoản mới nhất người kia đã có trên máy', () => {
    const data = withTransactions([
      byB('t1', '2026-10-01', '2026-10-01T09:00:00.000Z'),
      byB('t2', '2026-10-02', '2026-10-03T09:00:00.000Z', { deleted: true }),
      makeTx({ date: '2026-10-05', amount: 1, paidBy: A, createdAt: '2026-10-05T00:00:00.000Z' }),
    ]);
    const mark = initialSeenMark(data, A);
    expect(mark).toBe('2026-10-03T09:00:00.000Z');
    expect(newTransactionsFromOther(data, A, mark)).toEqual([]);
  });

  it('người kia chưa có khoản nào thì mọi khoản sau này đều là mới', () => {
    expect(initialSeenMark(withTransactions([]), A)).toBe(NOTHING_SEEN);
  });
});

describe('seenMarkAfter', () => {
  it('lùi không được, tiến tới khoản mới nhất đã xem', () => {
    const shown = [
      byB('t1', '2026-10-20', '2026-10-25T10:00:00.000Z'),
      byB('t2', '2026-10-24', '2026-10-25T09:00:00.000Z'),
    ];
    expect(seenMarkAfter('2026-10-24T00:00:00.000Z', shown)).toBe('2026-10-25T10:00:00.000Z');
    expect(seenMarkAfter('2026-10-26T00:00:00.000Z', shown)).toBe('2026-10-26T00:00:00.000Z');
  });
});
