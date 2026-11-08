// Service worker (sw.js, tạo lúc build — xem plugin `webApp` trong vite.config.ts): lưu sẵn các
// file của app để mở được khi không có mạng. Chỉ đăng ký ở bản build, không ở `npm run dev:web`.

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((error: unknown) => console.warn('Không đăng ký được service worker:', error));
  });
}

/** Đang chạy như app đã thêm vào Màn hình chính (không phải một tab Safari). */
export function isInstalledApp(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}
