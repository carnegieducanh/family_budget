import { useSyncExternalStore } from 'react';
import { resolveColorScheme, useThemeStore, type ColorScheme } from '../state/themeStore';

const query = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * 'dark' hoặc 'light' đang áp dụng: theo lựa chọn Sáng/Tối của người dùng, hoặc theo hệ thống
 * khi chọn "Theo hệ thống". Tự cập nhật khi một trong hai thay đổi.
 */
export function useColorScheme(): ColorScheme {
  const preference = useThemeStore((s) => s.preference);
  const systemDark = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
  return resolveColorScheme(preference, systemDark);
}
