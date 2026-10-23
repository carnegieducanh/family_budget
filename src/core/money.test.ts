import { describe, expect, it } from 'vitest';
import { formatYen, parseYen } from './money';

describe('formatYen', () => {
  it('thêm ký hiệu ¥ và dấu phẩy ngăn cách hàng nghìn', () => {
    expect(formatYen(12500)).toBe('¥12,500');
    expect(formatYen(1234567)).toBe('¥1,234,567');
  });

  it('số nhỏ và số 0', () => {
    expect(formatYen(0)).toBe('¥0');
    expect(formatYen(999)).toBe('¥999');
  });

  it('số âm đặt dấu trừ trước ký hiệu', () => {
    expect(formatYen(-42500)).toBe('-¥42,500');
  });

  it('phần chịu lẻ nửa yên hiện đúng ¥500.5 (ví dụ SPEC mục 6)', () => {
    expect(formatYen(500.5)).toBe('¥500.5');
  });
});

describe('parseYen', () => {
  it.each([
    ['12500', 12500],
    ['12,500', 12500],
    ['¥12,500', 12500],
    [' 3000円 ', 3000],
    ['', null],
    ['0', null],
    ['-5', null],
    ['12.5', null],
    ['abc', null],
  ])('"%s" → %s', (text, expected) => {
    expect(parseYen(text)).toBe(expected);
  });
});
