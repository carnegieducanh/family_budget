import { create } from 'zustand';

// Cỡ chữ của giao diện. Giống theme: là lựa chọn của từng máy, lưu trong localStorage của WebView
// để index.html đặt data-font-size trước khi vẽ lần đầu. tokens.scss đổi --font-scale theo
// data-font-size; mọi cỡ chữ đều nhân với hệ số này.

/** Từ nhỏ đến lớn; 'sm' là cỡ chữ ban đầu của app (thân bài 14 px). */
export const FONT_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type FontSize = (typeof FONT_SIZES)[number];

/** Khóa localStorage; index.html đọc cùng khóa. */
export const FONT_SIZE_STORAGE_KEY = 'family-budget.font-size';

export function parseFontSize(value: unknown): FontSize {
  return FONT_SIZES.find((size) => size === value) ?? 'sm';
}

function readStored(): FontSize {
  try {
    return parseFontSize(localStorage.getItem(FONT_SIZE_STORAGE_KEY));
  } catch {
    return 'sm';
  }
}

function apply(size: FontSize) {
  const root = document.documentElement;
  if (size === 'sm') delete root.dataset.fontSize;
  else root.dataset.fontSize = size;
}

interface FontSizeState {
  size: FontSize;
  setSize(size: FontSize): void;
}

export const useFontSizeStore = create<FontSizeState>()((set) => ({
  size: readStored(),

  setSize: (size) => {
    try {
      if (size === 'sm') localStorage.removeItem(FONT_SIZE_STORAGE_KEY);
      else localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
    } catch {
      // Không lưu được thì vẫn đổi cỡ chữ cho lần mở app này.
    }
    apply(size);
    set({ size });
  },
}));
