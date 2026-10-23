import type { BaseRecord } from './types';

type RecordFields<T extends BaseRecord> = Omit<T, keyof BaseRecord>;

/** Tạo bản ghi mới với đủ trường chung. */
export function createRecord<T extends BaseRecord>(
  id: string,
  fields: RecordFields<T>,
  userId: string,
  now: Date,
): T {
  const at = now.toISOString();
  return { ...fields, id, createdAt: at, updatedAt: at, updatedBy: userId, deleted: false } as T;
}

/** Sửa bản ghi: luôn cập nhật `updatedAt`, `updatedBy`. */
export function touch<T extends BaseRecord>(
  record: T,
  changes: Partial<RecordFields<T>>,
  userId: string,
  now: Date,
): T {
  return { ...record, ...changes, updatedAt: now.toISOString(), updatedBy: userId };
}

/** Xóa mềm: không bao giờ xóa bản ghi khỏi danh sách (SPEC mục 4). */
export function softDelete<T extends BaseRecord>(record: T, userId: string, now: Date): T {
  const at = now.toISOString();
  return { ...record, deleted: true, deletedAt: at, updatedAt: at, updatedBy: userId };
}

/** Thay bản ghi cùng id, hoặc thêm vào cuối nếu chưa có. */
export function upsert<T extends BaseRecord>(list: readonly T[], record: T): T[] {
  const index = list.findIndex((item) => item.id === record.id);
  if (index === -1) return [...list, record];
  const next = [...list];
  next[index] = record;
  return next;
}

/** Các bản ghi chưa bị xóa mềm. */
export function active<T extends BaseRecord>(list: readonly T[]): T[] {
  return list.filter((item) => !item.deleted);
}
