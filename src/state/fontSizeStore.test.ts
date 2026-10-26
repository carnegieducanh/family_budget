import { describe, expect, it } from 'vitest';
import { parseFontSize } from './fontSizeStore';

describe('parseFontSize', () => {
  it('nhận các cỡ đã định nghĩa, mọi giá trị khác là cỡ ban đầu', () => {
    expect(parseFontSize('md')).toBe('md');
    expect(parseFontSize('lg')).toBe('lg');
    expect(parseFontSize('xl')).toBe('xl');
    expect(parseFontSize(null)).toBe('sm');
    expect(parseFontSize('huge')).toBe('sm');
  });
});
