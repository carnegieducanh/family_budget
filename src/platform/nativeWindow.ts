import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ColorScheme } from '../state/themeStore';

// Cửa sổ của app desktop (Tauri). Bản web dùng nativeWindow.web.ts.

/** Theme của cửa sổ (thanh tiêu đề của hệ điều hành); null là đi theo hệ thống. */
export function setWindowTheme(scheme: ColorScheme | null): void {
  // Lỗi (ví dụ chạy ngoài Tauri) chỉ làm thanh tiêu đề lệch màu.
  getCurrentWindow()
    .setTheme(scheme)
    .catch(() => undefined);
}

/** Màu thanh tiêu đề cửa sổ (lệnh set_title_bar_color, Windows 11). */
export function setTitleBarColor(color: string): void {
  invoke('set_title_bar_color', { color }).catch(() => undefined);
}

/** Gọi `callback` mỗi khi cửa sổ được focus lại. Trả về hàm hủy theo dõi. */
export function onWindowFocus(callback: () => void): Promise<() => void> {
  return getCurrentWindow().onFocusChanged(({ payload: focused }) => {
    if (focused) callback();
  });
}
