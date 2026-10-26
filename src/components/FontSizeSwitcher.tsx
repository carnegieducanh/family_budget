import { useFontSizeStore, type FontSize } from '../state/fontSizeStore';
// Cùng kiểu nhóm nút với bộ chọn theme để hai dòng của thẻ Giao diện trông như nhau.
import styles from './ThemeSwitcher.module.scss';

const OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'sm', label: 'Nhỏ' },
  { value: 'md', label: 'Vừa' },
  { value: 'lg', label: 'Lớn' },
  { value: 'xl', label: 'Rất lớn' },
];

/** Chọn cỡ chữ của giao diện. */
export function FontSizeSwitcher() {
  const size = useFontSizeStore((s) => s.size);
  const setSize = useFontSizeStore((s) => s.setSize);

  return (
    <div role="radiogroup" aria-label="Cỡ chữ" className={styles.group}>
      {OPTIONS.map(({ value, label }) => {
        const checked = value === size;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            className={checked ? `${styles.option} ${styles.checked}` : styles.option}
            onClick={() => setSize(value)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
