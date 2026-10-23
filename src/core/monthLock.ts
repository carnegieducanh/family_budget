import { DomainError } from './errors';
import { formatMonthLabel, toMonth } from './month';
import { createRecord, touch } from './records';
import type { MonthRecord } from './types';

// Quy tắc khóa tháng (SPEC mục 6). Không có job chạy nền: trạng thái khóa luôn được
// tính tại thời điểm kiểm tra từ `now`.

export const UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000;

export function monthRecordId(month: string): string {
  return `month-${month}`;
}

/** Bản ghi tháng còn hiệu lực (bỏ qua bản đã xóa mềm). */
export function findMonthRecord(
  months: readonly MonthRecord[],
  month: string,
): MonthRecord | undefined {
  return months.find((record) => record.month === month && !record.deleted);
}

/** Tháng đã qua theo giờ local, tức là từ ngày 1 của tháng sau trở đi. */
export function isPastMonth(month: string, now: Date): boolean {
  return month < toMonth(now);
}

/** Admin đang mở khóa tạm và chưa hết hạn. */
export function isTemporarilyUnlocked(record: MonthRecord | undefined, now: Date): boolean {
  if (!record || record.deleted || !record.manualUnlockUntil) return false;
  return now.getTime() < Date.parse(record.manualUnlockUntil);
}

/**
 * Tháng bị khóa khi đã qua (theo giờ local) và không trong thời gian admin mở khóa tạm.
 * Tháng hiện tại và các tháng tương lai không bao giờ bị khóa.
 */
export function isLocked(month: string, now: Date, record?: MonthRecord): boolean {
  return isPastMonth(month, now) && !isTemporarilyUnlocked(record, now);
}

export function lockedMonthMessage(month: string): string {
  return `${formatMonthLabel(month)} đã khóa, không thể thêm, sửa hay xóa khoản chi.`;
}

/** Ném lỗi nếu tháng đang khóa. Dùng trong mọi hàm thao tác dữ liệu, không chỉ ở UI. */
export function assertMonthEditable(
  month: string,
  months: readonly MonthRecord[],
  now: Date,
): void {
  if (isLocked(month, now, findMonthRecord(months, month))) {
    throw new DomainError(lockedMonthMessage(month));
  }
}

/** Mở khóa tạm 24 giờ. Trả về bản ghi tháng mới hoặc đã cập nhật. */
export function unlockMonth(
  months: readonly MonthRecord[],
  month: string,
  userId: string,
  now: Date,
): MonthRecord {
  if (!isPastMonth(month, now)) {
    throw new DomainError(`${formatMonthLabel(month)} chưa khóa.`);
  }
  const manualUnlockUntil = new Date(now.getTime() + UNLOCK_DURATION_MS).toISOString();
  const existing = findMonthRecord(months, month);
  return existing
    ? touch(existing, { manualUnlockUntil }, userId, now)
    : createRecord<MonthRecord>(monthRecordId(month), { month, manualUnlockUntil }, userId, now);
}

/** Khóa lại sớm trước khi hết 24 giờ. */
export function relockMonth(
  months: readonly MonthRecord[],
  month: string,
  userId: string,
  now: Date,
): MonthRecord {
  const existing = findMonthRecord(months, month);
  if (!existing || !isTemporarilyUnlocked(existing, now)) {
    throw new DomainError(`${formatMonthLabel(month)} không ở trạng thái mở khóa tạm.`);
  }
  const { manualUnlockUntil, ...rest } = existing;
  return touch(rest as MonthRecord, {}, userId, now);
}
