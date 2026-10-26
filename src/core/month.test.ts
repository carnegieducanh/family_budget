import { describe, expect, it } from 'vitest';
import {
  addMonths,
  formatDate,
  formatMonthLabel,
  formatMonthShort,
  formatTimeAgo,
  isPastMonth,
  isValidDate,
  isValidMonth,
  monthOfDate,
  toLocalDate,
  toMonth,
} from './month';
import { localTime } from './testing';

describe('month helpers', () => {
  it('ngày và tháng theo giờ local', () => {
    const now = localTime(2026, 10, 31, 23, 59, 59);
    expect(toLocalDate(now)).toBe('2026-10-31');
    expect(toMonth(now)).toBe('2026-10');
    expect(monthOfDate('2026-11-05')).toBe('2026-11');
  });

  it('cộng trừ tháng qua ranh giới năm', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', -12)).toBe('2025-10');
  });

  it('kiểm tra ngày hợp lệ', () => {
    expect(isValidDate('2026-10-23')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-1-01')).toBe(false);
    expect(isValidDate('')).toBe(false);
    expect(isValidMonth('2026-10')).toBe(true);
    expect(isValidMonth('2026-00')).toBe(false);
  });

  it('định dạng hiển thị', () => {
    expect(formatMonthLabel('2026-10')).toBe('Tháng 10/2026');
    expect(formatMonthLabel('2026-03')).toBe('Tháng 3/2026');
    expect(formatMonthShort('2026-03')).toBe('3/2026');
    expect(formatDate('2026-10-05')).toBe('05/10/2026');
  });
});

describe('isPastMonth — ranh giới tháng theo giờ local', () => {
  it('ngày cuối tháng lúc 23:59:59: tháng đó chưa qua', () => {
    const now = localTime(2026, 10, 31, 23, 59, 59);
    expect(isPastMonth('2026-10', now)).toBe(false);
    expect(isPastMonth('2026-09', now)).toBe(true);
  });

  it('ngày 1 lúc 00:00:00: tháng trước đã qua', () => {
    const now = localTime(2026, 11, 1, 0, 0, 0);
    expect(isPastMonth('2026-10', now)).toBe(true);
    expect(isPastMonth('2026-11', now)).toBe(false);
  });

  it('ngày cuối tháng 2 năm thường và năm nhuận', () => {
    expect(isPastMonth('2026-02', localTime(2026, 2, 28, 23, 59, 59))).toBe(false);
    expect(isPastMonth('2026-02', localTime(2026, 3, 1, 0, 0, 0))).toBe(true);
    expect(isPastMonth('2028-02', localTime(2028, 2, 29, 23, 59, 59))).toBe(false);
  });

  it('qua năm mới: tháng 12 năm trước đã qua', () => {
    const now = localTime(2027, 1, 1, 0, 0, 0);
    expect(isPastMonth('2026-12', now)).toBe(true);
    expect(isPastMonth('2027-01', now)).toBe(false);
  });

  it('tháng tương lai chưa qua', () => {
    expect(isPastMonth('2026-11', localTime(2026, 10, 23))).toBe(false);
    expect(isPastMonth('2027-03', localTime(2026, 10, 23))).toBe(false);
  });
});

describe('formatTimeAgo', () => {
  const now = localTime(2026, 10, 23, 14, 0);
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it.each([
    [30_000, 'vừa xong'],
    [5 * 60_000, '5 phút trước'],
    [59 * 60_000, '59 phút trước'],
    [2 * 3_600_000 + 5 * 60_000, '2 giờ trước'],
    [3 * 86_400_000, '3 ngày trước'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatTimeAgo(ago(ms), now)).toBe(expected);
  });

  it('thời điểm ở tương lai (lệch giờ) → vừa xong', () => {
    expect(formatTimeAgo(ago(-10 * 60_000), now)).toBe('vừa xong');
  });
});
