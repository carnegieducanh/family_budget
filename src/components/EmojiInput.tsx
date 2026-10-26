import { invoke } from '@tauri-apps/api/core';
import { useRef, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent } from 'react';

interface EmojiInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value: string;
  onChange: (value: string) => void;
}

// Phím không phải người dùng tự gõ vào ô: phím Win của lệnh mở bảng (Windows) và chữ
// bảng emoji chèn vào qua bộ gõ.
const PANEL_KEYS = new Set(['Meta', 'OS', 'Process', 'Unidentified']);

/**
 * Ô emoji: bấm vào là mở bảng emoji của hệ điều hành (Windows: như bấm Win + . ; macOS:
 * Emoji & Symbols) và emoji chọn được thay cho emoji cũ. Bảng vẫn mở sau khi chọn nên sau
 * mỗi lần chèn ô được chọn hết lại: chọn tiếp emoji khác là thay chứ không nối thêm.
 * Tự gõ phím trong ô thì ô lại như ô nhập thường.
 */
export function EmojiInput({
  value,
  onChange,
  onClick,
  onKeyDown,
  onBlur,
  ...rest
}: EmojiInputProps) {
  const picking = useRef(false);

  function handleClick(event: MouseEvent<HTMLInputElement>) {
    onClick?.(event);
    // Bấm đúp thì lần thứ hai sẽ đóng bảng vừa mở.
    if (event.detail > 1) return;
    event.currentTarget.select();
    picking.current = true;
    // Ngoài Tauri (chạy thử trên trình duyệt) không có lệnh này: ô vẫn gõ được.
    invoke('show_emoji_panel').catch(() => undefined);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!event.metaKey && !PANEL_KEYS.has(event.key)) picking.current = false;
    onKeyDown?.(event);
  }

  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        const input = e.currentTarget;
        if (picking.current) {
          requestAnimationFrame(() => {
            if (document.activeElement === input) input.select();
          });
        }
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onBlur={(e) => {
        picking.current = false;
        onBlur?.(e);
      }}
    />
  );
}
