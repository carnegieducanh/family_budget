import { useId, useState, type FormEvent } from 'react';
import { DEFAULT_BUDGET_MONTH, getBudgetAmount, recurringTotals } from '../../core/budget';
import { sortedCategories } from '../../core/categories';
import { formatYen, parseYen } from '../../core/money';
import { toMonth } from '../../core/month';
import type { RecurringInput } from '../../core/recurring';
import type { RecurringTemplate } from '../../core/types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { UserDot } from '../../components/UserDot';
import { useDataStore, useReadyData } from '../../state/dataStore';
import styles from './RecurringScreen.module.scss';

/** Modal thêm/sửa mẫu chi tiêu định kỳ. */
export function RecurringEditor({
  template,
  initial,
  onClose,
}: {
  template: RecurringTemplate | null;
  initial: RecurringInput | null;
  onClose: () => void;
}) {
  const { data, me, users } = useReadyData();
  const fieldId = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? me.id);
  const [dayOfMonth, setDayOfMonth] = useState(String(initial?.dayOfMonth ?? 1));
  const [startMonth, setStartMonth] = useState(initial?.startMonth ?? toMonth(new Date()));
  const [enabled, setEnabled] = useState(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const categories = sortedCategories(data.categories).filter(
    (c) => !c.hidden || c.id === initial?.categoryId,
  );
  const amountNumber = parseYen(amount);
  // Danh mục chưa có khoản định kỳ nào đang bật: ngân sách nhập tay (nếu có) sẽ bị thay.
  const replacedBudget =
    enabled && categoryId && !recurringTotals(data.recurring).has(categoryId)
      ? getBudgetAmount(data.budgets, DEFAULT_BUDGET_MONTH, categoryId)
      : null;

  function save(event: FormEvent) {
    event.preventDefault();
    const input: RecurringInput = {
      name,
      amount: amountNumber ?? Number.NaN,
      categoryId,
      paidBy,
      dayOfMonth: Number(dayOfMonth),
      startMonth,
      active: enabled,
    };
    try {
      const store = useDataStore.getState();
      if (template) store.updateRecurring(template.id, input);
      else store.addRecurring(input);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal
      title={template ? 'Sửa khoản định kỳ' : 'Thêm khoản định kỳ'}
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" form="recurring-form" variant="primary">
            Lưu
          </Button>
        </>
      }
    >
      <form id="recurring-form" className={styles.form} onSubmit={save}>
        <div className={styles.field}>
          <label htmlFor={`${fieldId}-name`}>Tên</label>
          <input
            id={`${fieldId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Tiền nhà"
            maxLength={60}
            autoFocus
          />
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor={`${fieldId}-amount`}>Số tiền (yên)</label>
            <input
              id={`${fieldId}-amount`}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
            <span className={styles.preview}>{amountNumber ? formatYen(amountNumber) : ' '}</span>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${fieldId}-category`}>Danh mục</label>
            <select
              id={`${fieldId}-category`}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="" disabled>
                Chọn danh mục
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {replacedBudget !== null && (
          <p className={styles.preview}>
            Ngân sách {formatYen(replacedBudget)} đang nhập tay của danh mục này sẽ được thay bằng
            tổng khoản định kỳ.
          </p>
        )}
        <div className={styles.field}>
          <span className={styles.label}>Người trả</span>
          <div className={styles.segmented} role="radiogroup" aria-label="Người trả">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                role="radio"
                aria-checked={paidBy === user.id}
                className={paidBy === user.id ? styles.segmentActive : styles.segment}
                onClick={() => setPaidBy(user.id)}
              >
                <UserDot user={user} />
                {user.name}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor={`${fieldId}-day`}>Ngày trong tháng (1–28)</label>
            <input
              id={`${fieldId}-day`}
              type="number"
              min={1}
              max={28}
              step={1}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={`${fieldId}-start`}>Bắt đầu từ tháng</label>
            <input
              id={`${fieldId}-start`}
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
            />
          </div>
        </div>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Đang bật (tự tạo khoản chi mỗi tháng)
        </label>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
