import { useSyncExternalStore } from 'react';

const query = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** 'dark' hoặc 'light' theo hệ thống; tự cập nhật khi người dùng đổi. */
export function useColorScheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, () =>
    window.matchMedia(query).matches ? 'dark' : 'light',
  );
}
