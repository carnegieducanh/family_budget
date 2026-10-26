import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthLabel, toMonth } from '../core/month';
import { useUiStore } from '../state/uiStore';
import { useNow } from '../state/useNow';
import { Button } from './Button';
import styles from './MonthHeader.module.scss';

/** Tiêu đề màn hình kèm bộ chọn tháng `‹ Tháng 10/2026 ›`. */
export function MonthHeader({ title }: { title: string }) {
  const month = useUiStore((s) => s.month);
  const shiftMonth = useUiStore((s) => s.shiftMonth);
  const setMonth = useUiStore((s) => s.setMonth);
  const currentMonth = toMonth(useNow());

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>

      <div className={styles.picker}>
        {month !== currentMonth && (
          <Button variant="secondary" size="sm" onClick={() => setMonth(currentMonth)}>
            Về tháng này
          </Button>
        )}
        <div className={styles.stepper}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => shiftMonth(-1)}
            aria-label="Tháng trước"
            title="Tháng trước"
          >
            <ChevronLeft size={18} />
          </Button>
          <span className={styles.month}>
            <CalendarDays size={15} aria-hidden="true" />
            {formatMonthLabel(month)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => shiftMonth(1)}
            aria-label="Tháng sau"
            title="Tháng sau"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
}
