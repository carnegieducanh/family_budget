/** macOS dùng ⌘, Windows dùng Ctrl. */
export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

/** "Ctrl+N" trên Windows, "⌘N" trên macOS. */
export function shortcutLabel(key: string): string {
  return isMac ? `⌘${key}` : `Ctrl+${key}`;
}
