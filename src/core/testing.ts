// Dữ liệu mẫu dùng chung cho các file *.test.ts trong core/.

import { createInitialData } from './defaults';
import type { DataFile, Transaction } from './types';

/** Thời điểm theo giờ local (tháng tính từ 1), để test không phụ thuộc múi giờ máy chạy. */
export function localTime(year: number, month: number, day: number, h = 12, m = 0, s = 0): Date {
  return new Date(year, month - 1, day, h, m, s);
}

export const NOW = localTime(2026, 10, 23);

/** Dữ liệu có 2 người: A là admin, B là member, kèm danh mục mặc định. */
export function makeData(): { data: DataFile; a: string; b: string } {
  const ids = ['user-a', 'user-b'];
  let next = 0;
  const { data } = createInitialData({
    deviceId: 'device-1',
    myName: 'An',
    otherName: 'Bình',
    now: localTime(2026, 1, 1),
    newId: () => ids[next++] ?? `id-${next}`,
  });
  return { data, a: 'user-a', b: 'user-b' };
}

let txCounter = 0;

export function makeTx(
  fields: Pick<Transaction, 'date' | 'amount' | 'paidBy'> & Partial<Transaction>,
): Transaction {
  txCounter += 1;
  const at = '2026-01-01T00:00:00.000Z';
  return {
    id: `tx-${txCounter}`,
    createdAt: at,
    updatedAt: at,
    updatedBy: fields.paidBy,
    deleted: false,
    categoryId: 'cat-grocery',
    note: '',
    createdBy: fields.paidBy,
    ...fields,
  };
}
