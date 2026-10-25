import { describe, expect, it } from 'vitest';
import { parseThemePreference, resolveColorScheme } from './themeStore';

describe('parseThemePreference', () => {
  it('nhận light và dark, mọi giá trị khác là theo hệ thống', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('blue')).toBe('system');
  });
});

describe('resolveColorScheme', () => {
  it('lựa chọn Sáng/Tối thắng chế độ của hệ thống', () => {
    expect(resolveColorScheme('light', true)).toBe('light');
    expect(resolveColorScheme('dark', false)).toBe('dark');
  });

  it('theo hệ thống thì lấy chế độ của hệ thống', () => {
    expect(resolveColorScheme('system', true)).toBe('dark');
    expect(resolveColorScheme('system', false)).toBe('light');
  });
});
