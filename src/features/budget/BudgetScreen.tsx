import { Lock, OctagonAlert } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { DEFAULT_BUDGET_MONTH, findBudget, getBudgetAmount } from '../../core/budget';
import { sortedCategories } from '../../core/categories';
import { formatYen, parseYen } from '../../core/money';
import { formatMonthLabel } from '../../core/month';
import { findMonthRecord, isLocked } from '../../core/monthLock';
import { spendingByCategory, sumAmounts, transactionsInMonth } from '../../core/queries';
import type { Budget } from '../../core/types';
import { Card } from '../../components/Card';
import { CategoryLabel } from '../../components/CategoryLabel';
import { MonthHeader } from '../../components/MonthHeader';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import { useNow } from '../../state/useNow';
import styles from './BudgetScreen.module.scss';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Ngân sách (admin): ngân sách tổng và theo danh mục, mức mặc định hàng tháng và mức
 * riêng cho từng tháng (SPEC mục 8, màn hình 6).
 */
export function BudgetScreen() {
  const month = useUiStore((s) => s.month);
  const { data } = useReadyData();
  const now = useNow();
  const [error, setError] = useState<string | null>(null);

  const locked = isLocked(month, now, findMonthRecord(data.months, month));
  const spent = new Map(
    spendingByCategory(data.transactions, month).map((s) => [s.categoryId, s.amount]),
  );
  const total = sumAmounts(transactionsInMonth(data.transactions, month));
  // Danh mục ẩn vẫn hiện nếu đang có ngân sách, để bỏ được mức đó.
  const categories = sortedCategories(data.categories).filter(
    (c) =>
      !c.hidden ||
      getBudgetAmount(data.budgets, DEFAULT_BUDGET_MONTH, c.id) !== null ||
      getBudgetAmount(data.budgets, month, c.id) !== null,
  );
  const rows: Array<{ categoryId: string | null; spent: number }> = [
    { categoryId: null, spent: total },
    ...categories.map((c) => ({ categoryId: c.id, spent: spent.get(c.id) ?? 0 })),
  ];
  const categoriesById = new Map(data.categories.map((c) => [c.id, c]));

  function save(target: string, categoryId: string | null, amount: number | null): boolean {
    try {
      useDataStore.getState().setBudget(target, categoryId, amount);
      setError(null);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }

  const invalid = () => setError('Ngân sách phải là số nguyên yên lớn hơn 0, ví dụ 300,000.');

  return (
    <>
      <MonthHeader title="Ngân sách" />
      <p className={styles.lead}>
        Mức mặc định áp dụng cho mọi tháng chưa đặt mức riêng. Để trống ô của tháng để dùng mức mặc
        định; để trống cả hai là không đặt ngân sách.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Card>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Danh mục</th>
                <th className={styles.num}>Mặc định hàng tháng</th>
                <th className={styles.num}>Riêng {formatMonthLabel(month).toLowerCase()}</th>
                <th className={styles.num}>Đang áp dụng</th>
                <th className={styles.num}>Đã chi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ categoryId, spent: spentAmount }) => {
                const effective = getBudgetAmount(data.budgets, month, categoryId);
                return (
                  <tr key={categoryId ?? 'total'} className={categoryId ? undefined : styles.total}>
                    <td>
                      {categoryId ? (
                        <CategoryLabel category={categoriesById.get(categoryId)} />
                      ) : (
                        'Tổng ngân sách'
                      )}
                    </td>
                    <td className={styles.num}>
                      <BudgetInput
                        budget={findBudget(data.budgets, DEFAULT_BUDGET_MONTH, categoryId)}
                        label="Mức mặc định"
                        onSave={(amount) => save(DEFAULT_BUDGET_MONTH, categoryId, amount)}
                        onInvalid={invalid}
                      />
                    </td>
                    <td className={styles.num}>
                      <BudgetInput
                        budget={findBudget(data.budgets, month, categoryId)}
                        label={`Mức riêng ${formatMonthLabel(month)}`}
                        placeholder="Theo mặc định"
                        disabled={locked}
                        onSave={(amount) => save(month, categoryId, amount)}
                        onInvalid={invalid}
                      />
                    </td>
                    <td className={styles.num}>
                      {effective === null ? (
                        <span className={styles.muted}>—</span>
                      ) : (
                        formatYen(effective)
                      )}
                    </td>
                    <td className={styles.num}>
                      {formatYen(spentAmount)}
                      {effective !== null && spentAmount > effective && (
                        <span className={styles.over}>
                          <OctagonAlert size={12} aria-hidden="true" /> vượt
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {locked && (
          <p className={styles.note}>
            <Lock size={13} aria-hidden="true" /> {formatMonthLabel(month)} đã khóa nên không sửa
            được mức riêng của tháng này.
          </p>
        )}
      </Card>
    </>
  );
}

function formatAmount(budget: Budget | undefined): string {
  return budget && !budget.deleted ? budget.amount.toLocaleString('en-US') : '';
}

/** Ô số tiền ngân sách: lưu khi rời ô hoặc bấm Enter; để trống là bỏ mức đó. */
function BudgetInput({
  budget,
  label,
  placeholder = '—',
  disabled = false,
  onSave,
  onInvalid,
}: {
  budget: Budget | undefined;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  onSave: (amount: number | null) => boolean;
  onInvalid: () => void;
}) {
  const [text, setText] = useState(formatAmount(budget));
  const [savedAt, setSavedAt] = useState(budget?.updatedAt);

  // Dữ liệu đổi từ nơi khác (sync, lưu xong): lấy lại giá trị mới.
  if (savedAt !== budget?.updatedAt) {
    setSavedAt(budget?.updatedAt);
    setText(formatAmount(budget));
  }

  function commit() {
    const trimmed = text.trim();
    const amount = trimmed === '' ? null : parseYen(trimmed);
    if (trimmed !== '' && amount === null) {
      onInvalid();
      setText(formatAmount(budget));
      return;
    }
    const current = budget && !budget.deleted ? budget.amount : null;
    if (amount === current) {
      setText(formatAmount(budget));
      return;
    }
    if (!onSave(amount)) setText(formatAmount(budget));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') setText(formatAmount(budget));
  }

  return (
    <input
      className={styles.input}
      inputMode="numeric"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => setText(e.target.value.replace(/,/g, ''))}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}
