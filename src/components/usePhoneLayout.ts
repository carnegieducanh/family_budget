import { useSyncExternalStore } from 'react';

// Cùng mốc với mixin `phone` trong styles/_mixins.scss.
const query = '(max-width: 639px)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * Màn hình điện thoại (bản web, hẹp hơn 640 px): bảng thành danh sách. Cửa sổ app desktop không
 * co nhỏ hơn 640 px nên luôn là false ở desktop.
 */
export function usePhoneLayout(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
