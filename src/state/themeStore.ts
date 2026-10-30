import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { create } from 'zustand';

// Theme của giao diện: Sáng, Tối hoặc Theo hệ thống. Là lựa chọn của từng máy, lưu trong
// localStorage của WebView (không vào settings.json) để đọc được đồng bộ ngay lúc mở app,
// trước khi vẽ lần đầu: index.html có đoạn script nhỏ đặt data-theme từ cùng khóa này.

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

/** Khóa localStorage; index.html đọc cùng khóa. */
export const THEME_STORAGE_KEY = 'family-budget.theme';

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Theme thực sự áp dụng khi biết lựa chọn và chế độ của hệ thống. */
export function resolveColorScheme(preference: ThemePreference, systemDark: boolean): ColorScheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

function readStored(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

/** Thanh tiêu đề cùng màu sidebar của theme đang áp dụng (lệnh set_title_bar_color, Windows 11). */
function applyTitleBarColor() {
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-sidebar')
    .trim();
  if (color) invoke('set_title_bar_color', { color }).catch(() => undefined);
}

/** Đặt data-theme cho CSS và theme cửa sổ (thanh tiêu đề của hệ điều hành). */
function apply(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === 'system') delete root.dataset.theme;
  else root.dataset.theme = preference;
  // null = cửa sổ đi theo hệ thống. Lỗi (ví dụ chạy ngoài Tauri) chỉ làm thanh tiêu đề lệch màu.
  getCurrentWindow()
    .setTheme(preference === 'system' ? null : preference)
    .catch(() => undefined);
  applyTitleBarColor();
}

interface ThemeState {
  preference: ThemePreference;
  setPreference(preference: ThemePreference): void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  preference: readStored(),

  setPreference: (preference) => {
    try {
      if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Không lưu được thì vẫn đổi theme cho lần mở app này.
    }
    // set() nằm trong change: React vẽ lại (biểu đồ tô màu bằng JS) ngay ở microtask sau đó,
    // trước khi trình duyệt chụp ảnh theme mới, nên cũng mờ dần cùng phần còn lại.
    const change = () => {
      apply(preference);
      set({ preference });
    };
    // Cả màn hình mờ dần sang theme mới (View Transitions API); WebView không hỗ trợ thì đổi ngay.
    if (document.startViewTransition) document.startViewTransition(change);
    else change();
  },
}));

/** Gọi một lần khi mở app: áp dụng theme đã lưu cho cả thanh tiêu đề của cửa sổ. */
export function initTheme() {
  apply(useThemeStore.getState().preference);
  // Chọn "Theo hệ thống" thì màu sidebar đổi theo hệ điều hành mà không qua apply().
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTitleBarColor);
}
