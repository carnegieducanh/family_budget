import { OctagonAlert, TriangleAlert } from 'lucide-react';
import { budgetLevel } from '../../core/budget';
import { formatYen } from '../../core/money';
import styles from './BudgetMeter.module.scss';

const LEVEL_LABEL = {
  ok: null,
  warning: { icon: TriangleAlert, text: 'Đã dùng hơn 80% ngân sách' },
  over: { icon: OctagonAlert, text: 'Vượt ngân sách' },
} as const;

/** Thanh tiến độ ngân sách tổng: đổi màu khi vượt 80% và 100%, luôn kèm chữ. */
export function BudgetMeter({ spent, budget }: { spent: number; budget: number | null }) {
  if (budget === null) {
    return <p className={styles.none}>Chưa đặt ngân sách cho tháng này.</p>;
  }
  const level = budgetLevel(spent, budget);
  const ratio = budget > 0 ? spent / budget : 1;
  const label = LEVEL_LABEL[level];
  const remaining = budget - spent;

  return (
    <div className={styles.meter}>
      <div
        className={`${styles.track} ${styles[level]}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={spent}
        aria-label="Ngân sách đã dùng"
      >
        <div className={styles.fill} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      <div className={styles.caption}>
        <span>
          {Math.round(ratio * 100)}% của {formatYen(budget)}
        </span>
        <span>
          {remaining >= 0 ? `Còn ${formatYen(remaining)}` : `Vượt ${formatYen(-remaining)}`}
        </span>
      </div>
      {label && (
        <p className={`${styles.status} ${styles[`${level}Text`]}`}>
          <label.icon size={15} aria-hidden="true" /> {label.text}
        </p>
      )}
    </div>
  );
}
