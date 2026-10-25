import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeStore, type ThemePreference } from '../state/themeStore';
import styles from './ThemeSwitcher.module.scss';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Tối', icon: Moon },
  { value: 'system', label: 'Theo hệ thống', icon: Monitor },
];

/**
 * Chọn theme Sáng / Tối / Theo hệ thống. `compact`: chỉ icon (sidebar), tên hiện ở tooltip.
 * Dùng role radiogroup để trình đọc màn hình đọc đúng lựa chọn đang bật.
 */
export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <div
      role="radiogroup"
      aria-label="Giao diện"
      className={compact ? `${styles.group} ${styles.compact}` : styles.group}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const checked = value === preference;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={compact ? label : undefined}
            title={compact ? label : undefined}
            className={checked ? `${styles.option} ${styles.checked}` : styles.option}
            onClick={() => setPreference(value)}
          >
            <Icon size={16} aria-hidden="true" />
            {!compact && label}
          </button>
        );
      })}
    </div>
  );
}
