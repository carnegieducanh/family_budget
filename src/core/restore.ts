import { DomainError } from './errors';
import { sameHousehold } from './household';
import { sameRecord } from './merge';
import { active, softDelete } from './records';
import type { BaseRecord, DataFile } from './types';

// Khôi phục backup (SPEC mục 9). Không chỉ ghi đè file local, vì lượt sync sau sẽ kéo dữ
// liệu mới hơn từ máy kia về: mỗi bản ghi khác với snapshot được ghi lại bản trong snapshot
// với updatedAt = bây giờ; bản ghi không có trong snapshot thì xóa mềm với updatedAt = bây
// giờ. Nhờ vậy bản khôi phục thắng khi merge ở máy kia.

export interface RestorePlan {
  data: DataFile;
  /** Số bản ghi được ghi lại theo snapshot (thêm lại, sửa lại, hoặc xóa lại). */
  rewritten: number;
  /** Số bản ghi bị xóa mềm vì không có trong snapshot. */
  removed: number;
}

function restoreRecords<T extends BaseRecord>(
  current: readonly T[],
  snapshot: readonly T[],
  userId: string,
  now: Date,
): { records: T[]; rewritten: number; removed: number } {
  const at = now.toISOString();
  const currentById = new Map(current.map((r) => [r.id, r]));
  const snapshotIds = new Set(snapshot.map((r) => r.id));
  let rewritten = 0;
  let removed = 0;

  const records = snapshot.map((record) => {
    const existing = currentById.get(record.id);
    if (existing && sameRecord(existing, record)) return existing;
    rewritten++;
    return { ...record, updatedAt: at, updatedBy: userId };
  });
  for (const record of current) {
    if (snapshotIds.has(record.id)) continue;
    if (record.deleted) {
      records.push(record);
    } else {
      removed++;
      records.push(softDelete(record, userId, now));
    }
  }
  return { records, rewritten, removed };
}

/** Dữ liệu sau khi khôi phục `snapshot`, kèm số bản ghi thay đổi để hiện trước khi xác nhận. */
export function planRestore(
  current: DataFile,
  snapshot: DataFile,
  userId: string,
  now: Date,
): RestorePlan {
  if (!sameHousehold(current, snapshot)) {
    throw new DomainError('Bản backup này thuộc một gia đình khác (người dùng không khớp).');
  }
  let rewritten = 0;
  let removed = 0;
  const restore = <T extends BaseRecord>(cur: readonly T[], snap: readonly T[]): T[] => {
    const result = restoreRecords(cur, snap, userId, now);
    rewritten += result.rewritten;
    removed += result.removed;
    return result.records;
  };
  const data: DataFile = {
    ...current,
    users: restore(current.users, snapshot.users),
    categories: restore(current.categories, snapshot.categories),
    transactions: restore(current.transactions, snapshot.transactions),
    budgets: restore(current.budgets, snapshot.budgets),
    recurring: restore(current.recurring, snapshot.recurring),
    months: restore(current.months, snapshot.months),
  };
  return { data, rewritten, removed };
}

export interface DataSummary {
  transactions: number;
  firstDate: string | null;
  lastDate: string | null;
}

/** Số khoản chi và khoảng ngày, để xem trước một bản backup. */
export function summarizeData(data: DataFile): DataSummary {
  const dates = active(data.transactions)
    .map((t) => t.date)
    .sort();
  return {
    transactions: dates.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}
