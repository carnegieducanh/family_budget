import { Lock } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { formatYen } from '../../core/money';
import { formatDate, monthOfDate, toLocalDate } from '../../core/month';
import { findMonthRecord, isLocked } from '../../core/monthLock';
import { can } from '../../core/permissions';
import { active } from '../../core/records';
import type { Transaction, TransactionInput } from '../../core/types';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { UserDot } from '../../components/UserDot';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { useUiStore, type EditorState } from '../../state/uiStore';
import styles from './TransactionEditor.module.scss';

/** Modal thêm/sửa khoản chi, mở từ bất kỳ màn hình nào qua uiStore. */
export function TransactionEditor() {
  const editor = useUiStore((s) => s.editor);
  if (editor.mode === 'closed') return null;
  // key: mở khoản khác thì form được tạo lại với giá trị mới.
  return <EditorForm key={editor.mode === 'edit' ? editor.id : 'create'} editor={editor} />;
}

function EditorForm({ editor }: { editor: Exclude<EditorState, { mode: 'closed' }> }) {
  const { data, me, users } = useReadyData();
  const close = useUiStore((s) => s.closeEditor);
  const existing: Transaction | undefined =
    editor.mode === 'edit'
      ? data.transactions.find((t) => t.id === editor.id && !t.deleted)
      : undefined;

  const [date, setDate] = useState(existing?.date ?? toLocalDate(new Date()));
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? me.id);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fieldId = useId();

  if (editor.mode === 'edit' && !existing) {
    return (
      <Modal title="Sửa khoản chi" onClose={close} footer={<Button onClick={close}>Đóng</Button>}>
        Không tìm thấy khoản chi này (có thể đã bị xóa).
      </Modal>
    );
  }

  const now = new Date();
  const locked =
    existing !== undefined &&
    isLocked(
      monthOfDate(existing.date),
      now,
      findMonthRecord(data.months, monthOfDate(existing.date)),
    );
  const forbidden = existing !== undefined && !can(me, 'transaction:edit', existing);
  const creator = existing && data.users.find((u) => u.id === existing.createdBy);
  const readOnly = locked || forbidden;
  // Danh mục ẩn không hiện trong danh sách chọn, trừ khi khoản đang sửa dùng danh mục đó.
  const categories = active(data.categories)
    .filter((c) => !c.hidden || c.id === existing?.categoryId)
    .sort((a, b) => a.order - b.order);
  const amountNumber = amount.trim() === '' ? Number.NaN : Number(amount);

  function save(event: FormEvent) {
    event.preventDefault();
    const input: TransactionInput = { date, amount: amountNumber, categoryId, note, paidBy };
    try {
      const store = useDataStore.getState();
      if (existing) store.updateTransaction(existing.id, input);
      else store.addTransaction(input);
      useUiStore.getState().setMonth(monthOfDate(date));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function remove() {
    if (!existing) return;
    try {
      useDataStore.getState().deleteTransaction(existing.id);
      close();
    } catch (e) {
      setConfirmDelete(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal
      title={existing ? 'Sửa khoản chi' : 'Thêm khoản chi'}
      onClose={close}
      footer={
        <>
          {existing && !readOnly && (
            <Button
              variant="ghost"
              className={styles.deleteButton}
              onClick={() => setConfirmDelete(true)}
            >
              Xóa
            </Button>
          )}
          <Button onClick={close}>{readOnly ? 'Đóng' : 'Hủy'}</Button>
          {!readOnly && (
            <Button type="submit" form="transaction-form" variant="primary">
              Lưu
            </Button>
          )}
        </>
      }
    >
      <form id="transaction-form" className={styles.form} onSubmit={save}>
        {locked && (
          <p className={styles.locked}>
            <Lock size={15} aria-hidden="true" /> Tháng đã khóa, chỉ xem được khoản này.
          </p>
        )}
        {!locked && forbidden && (
          <p className={styles.locked}>
            Khoản này do {creator?.name ?? 'người khác'} nhập, bạn chỉ xem được.
          </p>
        )}

        <fieldset className={styles.fieldset} disabled={readOnly}>
          <div className={styles.field}>
            <label htmlFor={`${fieldId}-amount`}>Số tiền (yên)</label>
            <input
              id={`${fieldId}-amount`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              placeholder="0"
              className={styles.amount}
            />
            <span className={styles.preview}>
              {Number.isSafeInteger(amountNumber) && amountNumber > 0
                ? formatYen(amountNumber)
                : ' '}
            </span>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor={`${fieldId}-date`}>Ngày thanh toán</label>
              <input
                id={`${fieldId}-date`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
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
                  {user.id === me.id && <span className={styles.meTag}>(bạn)</span>}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor={`${fieldId}-note`}>Ghi chú</label>
            <input
              id={`${fieldId}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Ví dụ: Siêu thị Aeon"
            />
          </div>
        </fieldset>

        {existing && (
          <p className={styles.meta}>
            Nhập bởi {creator?.name ?? 'không rõ'}
            {existing.recurringId && ' · khoản định kỳ'}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>

      {confirmDelete && existing && (
        <ConfirmDialog
          title="Xóa khoản chi?"
          confirmLabel="Xóa"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        >
          Xóa khoản {formatYen(existing.amount)} ngày {formatDate(existing.date)}
          {existing.note && ` (${existing.note})`}?
        </ConfirmDialog>
      )}
    </Modal>
  );
}
