import { useSyncExternalStore } from 'react';

// Cùng mốc với mixin `narrow` trong styles/_mixins.scss.
const query = '(max-width: 1023px)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * Cửa sổ hẹp hơn 1024 px (bề rộng tối thiểu trước đây): sidebar chỉ còn icon. Tự cập nhật
 * khi kéo cửa sổ qua mốc.
 */
export function useNarrowWindow(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
