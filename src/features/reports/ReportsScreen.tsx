import { OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  budgetLevel,
  categoryBudgetRows,
  getBudgetAmount,
  type BudgetLevel,
} from '../../core/budget';
import { formatYen } from '../../core/money';
import { formatMonthLabel } from '../../core/month';
import { monthlyTotals, sumAmounts, transactionsInMonth } from '../../core/queries';
import { Card } from '../../components/Card';
import { CategoryLabel } from '../../components/CategoryLabel';
import { MonthHeader } from '../../components/MonthHeader';
import { useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import { CsvExport } from '../data/CsvExport';
import { MonthlyChart } from './MonthlyChart';
import styles from './ReportsScreen.module.scss';

const LEVEL_LABEL: Record<BudgetLevel, { icon: LucideIcon; text: string } | null> = {
  ok: null,
  warning: { icon: TriangleAlert, text: 'Trên 80%' },
  over: { icon: OctagonAlert, text: 'Vượt' },
};

/** Báo cáo: tổng chi 12 tháng, chi theo danh mục so với ngân sách, export CSV (SPEC mục 8). */
export function ReportsScreen() {
  const month = useUiStore((s) => s.month);
  const setMonth = useUiStore((s) => s.setMonth);
  const { data } = useReadyData();

  const totals = monthlyTotals(data.transactions, month, 12);
  const rows = categoryBudgetRows(data, month);
  const total = sumAmounts(transactionsInMonth(data.transactions, month));
  const totalBudget = getBudgetAmount(data.budgets, month, null);
  const categoriesById = new Map(data.categories.map((c) => [c.id, c]));

  return (
    <>
      <MonthHeader title="Báo cáo" />
      <div className={styles.grid}>
        <Card title={`Tổng chi 12 tháng đến ${formatMonthLabel(month).toLowerCase()}`}>
          <MonthlyChart totals={totals} selected={month} onSelect={setMonth} />
          <details className={styles.details}>
            <summary>Xem bảng số liệu</summary>
            <table className={styles.table}>
              <tbody>
                {[...totals].reverse().map((item) => (
                  <tr key={item.month}>
                    <td>{formatMonthLabel(item.month)}</td>
                    <td className={styles.num}>{formatYen(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>

        <Card title={`Chi theo danh mục so với ngân sách — ${formatMonthLabel(month)}`}>
          {rows.length === 0 && totalBudget === null ? (
            <p className={styles.empty}>Chưa có khoản chi hay ngân sách nào trong tháng.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Danh mục</th>
                    <th className={styles.num}>Đã chi</th>
                    <th className={styles.num}>Ngân sách</th>
                    <th className={styles.meterCell}>Đã dùng</th>
                  </tr>
                </thead>
                <tbody>
                  <BudgetRow
                    label={<strong>Tổng</strong>}
                    spent={total}
                    budget={totalBudget}
                    level={totalBudget === null ? null : budgetLevel(total, totalBudget)}
                    strong
                  />
                  {rows.map((row) => (
                    <BudgetRow
                      key={row.categoryId}
                      label={<CategoryLabel category={categoriesById.get(row.categoryId)} />}
                      spent={row.spent}
                      budget={row.budget}
                      level={row.level}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Export CSV">
          <CsvExport key={month} defaultMonth={month} />
        </Card>
      </div>
    </>
  );
}

function BudgetRow({
  label,
  spent,
  budget,
  level,
  strong = false,
}: {
  label: ReactNode;
  spent: number;
  budget: number | null;
  level: BudgetLevel | null;
  strong?: boolean;
}) {
  const ratio = budget ? spent / budget : 0;
  const status = level ? LEVEL_LABEL[level] : null;
  return (
    <tr className={strong ? styles.strong : undefined}>
      <td>{label}</td>
      <td className={styles.num}>{formatYen(spent)}</td>
      <td className={styles.num}>{budget === null ? '—' : formatYen(budget)}</td>
      <td className={styles.meterCell}>
        {budget !== null && level && (
          <div className={styles.meterRow}>
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
            <span className={styles.percent}>{Math.round(ratio * 100)}%</span>
            {status && (
              <span className={styles[`${level}Text`]}>
                <status.icon size={14} aria-hidden="true" /> {status.text}
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
