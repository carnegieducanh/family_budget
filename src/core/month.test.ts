import { describe, expect, it } from 'vitest';
import {
  addMonths,
  formatDate,
  formatMonthLabel,
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
    expect(formatDate('2026-10-05')).toBe('05/10/2026');
  });
});
