import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import {
  UNLOCK_DURATION_MS,
  assertMonthEditable,
  isLocked,
  isPastMonth,
  relockMonth,
  unlockMonth,
} from './monthLock';
import { localTime } from './testing';
import type { MonthRecord } from './types';

const ADMIN = 'user-a';

function monthRecord(month: string, fields: Partial<MonthRecord> = {}): MonthRecord {
  return {
    id: `month-${month}`,
    month,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: ADMIN,
    deleted: false,
    ...fields,
  };
}

describe('isLocked — ranh giới tháng theo giờ local', () => {
  it('ngày cuối tháng lúc 23:59:59: tháng đó chưa khóa', () => {
    const now = localTime(2026, 10, 31, 23, 59, 59);
    expect(isLocked('2026-10', now)).toBe(false);
    expect(isLocked('2026-09', now)).toBe(true);
  });

  it('ngày 1 lúc 00:00:00: tháng trước khóa ngay', () => {
    const now = localTime(2026, 11, 1, 0, 0, 0);
    expect(isLocked('2026-10', now)).toBe(true);
    expect(isLocked('2026-11', now)).toBe(false);
  });

  it('ngày cuối tháng 2 năm thường và năm nhuận', () => {
    expect(isLocked('2026-02', localTime(2026, 2, 28, 23, 59, 59))).toBe(false);
    expect(isLocked('2026-02', localTime(2026, 3, 1, 0, 0, 0))).toBe(true);
    expect(isLocked('2028-02', localTime(2028, 2, 29, 23, 59, 59))).toBe(false);
  });

  it('qua năm mới: tháng 12 năm trước khóa', () => {
    const now = localTime(2027, 1, 1, 0, 0, 0);
    expect(isLocked('2026-12', now)).toBe(true);
    expect(isLocked('2027-01', now)).toBe(false);
  });

  it('tháng tương lai không khóa', () => {
    expect(isLocked('2026-11', localTime(2026, 10, 23))).toBe(false);
    expect(isLocked('2027-03', localTime(2026, 10, 23))).toBe(false);
  });

  it('isPastMonth khớp với isLocked khi không mở khóa tạm', () => {
    const now = localTime(2026, 11, 1, 0, 0, 0);
    expect(isPastMonth('2026-10', now)).toBe(true);
    expect(isPastMonth('2026-11', now)).toBe(false);
  });
});

describe('isLocked — admin mở khóa tạm', () => {
  const now = localTime(2026, 10, 23, 12, 0, 0);

  it('đang trong thời gian mở khóa tạm: không khóa', () => {
    const record = monthRecord('2026-09', {
      manualUnlockUntil: new Date(now.getTime() + 60_000).toISOString(),
    });
    expect(isLocked('2026-09', now, record)).toBe(false);
  });

  it('mở khóa tạm đã hết hạn: khóa lại', () => {
    const record = monthRecord('2026-09', {
      manualUnlockUntil: new Date(now.getTime() - 1).toISOString(),
    });
    expect(isLocked('2026-09', now, record)).toBe(true);
  });

  it('đúng thời điểm hết hạn: đã khóa', () => {
    const record = monthRecord('2026-09', { manualUnlockUntil: now.toISOString() });
    expect(isLocked('2026-09', now, record)).toBe(true);
  });

  it('bản ghi tháng đã xóa mềm không còn tác dụng mở khóa', () => {
    const record = monthRecord('2026-09', {
      manualUnlockUntil: new Date(now.getTime() + 60_000).toISOString(),
      deleted: true,
    });
    expect(isLocked('2026-09', now, record)).toBe(true);
  });
});

describe('unlockMonth / relockMonth', () => {
  const now = localTime(2026, 10, 23, 12, 0, 0);

  it('mở khóa tạm 24 giờ, tạo bản ghi tháng với id cố định', () => {
    const record = unlockMonth([], '2026-09', ADMIN, now);
    expect(record.id).toBe('month-2026-09');
    expect(Date.parse(record.manualUnlockUntil ?? '')).toBe(now.getTime() + UNLOCK_DURATION_MS);
    expect(isLocked('2026-09', now, record)).toBe(false);
    expect(isLocked('2026-09', new Date(now.getTime() + UNLOCK_DURATION_MS), record)).toBe(true);
  });

  it('mở khóa tạm giữ lại thông tin tất toán đã có', () => {
    const existing = monthRecord('2026-09', { settledAt: '2026-10-02T00:00:00.000Z' });
    const record = unlockMonth([existing], '2026-09', ADMIN, now);
    expect(record.settledAt).toBe(existing.settledAt);
    expect(record.updatedAt).toBe(now.toISOString());
  });

  it('không mở khóa được tháng hiện tại hoặc tương lai', () => {
    expect(() => unlockMonth([], '2026-10', ADMIN, now)).toThrow(DomainError);
    expect(() => unlockMonth([], '2026-12', ADMIN, now)).toThrow(DomainError);
  });

  it('khóa lại sớm: bỏ manualUnlockUntil và cập nhật updatedAt', () => {
    const unlocked = unlockMonth([], '2026-09', ADMIN, now);
    const later = new Date(now.getTime() + 60_000);
    const relocked = relockMonth([unlocked], '2026-09', ADMIN, later);
    expect(relocked.manualUnlockUntil).toBeUndefined();
    expect('manualUnlockUntil' in relocked).toBe(false);
    expect(relocked.updatedAt).toBe(later.toISOString());
    expect(isLocked('2026-09', later, relocked)).toBe(true);
  });

  it('không khóa lại được tháng không ở trạng thái mở khóa tạm', () => {
    expect(() => relockMonth([], '2026-09', ADMIN, now)).toThrow(DomainError);
  });
});

describe('assertMonthEditable', () => {
  const now = localTime(2026, 10, 23);

  it('ném lỗi tiếng Việt với tháng đã khóa', () => {
    expect(() => assertMonthEditable('2026-09', [], now)).toThrow('Tháng 9/2026 đã khóa');
  });

  it('cho phép tháng hiện tại và tháng đang mở khóa tạm', () => {
    expect(() => assertMonthEditable('2026-10', [], now)).not.toThrow();
    const unlocked = unlockMonth([], '2026-09', ADMIN, now);
    expect(() => assertMonthEditable('2026-09', [unlocked], now)).not.toThrow();
  });
});
