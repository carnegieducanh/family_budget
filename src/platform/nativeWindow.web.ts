import type { ColorScheme } from '../state/themeStore';

// Bản web của nativeWindow.ts: trình duyệt không có cửa sổ riêng của app.

export function setWindowTheme(scheme: ColorScheme | null): void {
  void scheme; // Trình duyệt tự theo theme của hệ thống, trang tự tô màu theo data-theme.
}

/**
 * Màu thanh trạng thái / thanh địa chỉ của trình duyệt trên điện thoại (`<meta name="theme-color">`),
 * cùng màu phần đầu trang.
 */
export function setTitleBarColor(color: string): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = color;
}

/** Trang được mở lại (chuyển từ app khác về, bật lại màn hình điện thoại). */
export function onWindowFocus(callback: () => void): Promise<() => void> {
  const onVisible = () => {
    if (document.visibilityState === 'visible') callback();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', callback);
  return Promise.resolve(() => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', callback);
  });
}
