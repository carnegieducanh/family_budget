import { Plus } from 'lucide-react';
import { useState } from 'react';
import { formatYen } from '../../core/money';
import { formatDate, formatMonthLabel, toMonth } from '../../core/month';
import { active } from '../../core/records';
import { recurringTransactionId, type RecurringInput } from '../../core/recurring';
import type { DataFile, RecurringTemplate } from '../../core/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CategoryLabel } from '../../components/CategoryLabel';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { UserName } from '../../components/UserDot';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { useNow } from '../../state/useNow';
import { RecurringEditor } from './RecurringEditor';
import styles from './RecurringScreen.module.scss';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Tình trạng khoản của tháng hiện tại sinh từ mẫu. */
function currentMonthStatus(template: RecurringTemplate, data: DataFile, now: Date): string {
  const month = toMonth(now);
  if (!template.active) return 'Đang tắt';
  if (template.startMonth > month) return `Bắt đầu từ ${formatMonthLabel(template.startMonth)}`;
  const tx = data.transactions.find((t) => t.id === recurringTransactionId(template.id, month));
  if (!tx) return 'Sắp tạo';
  if (tx.deleted) return 'Khoản tháng này đã bị xóa';
  return `Đã tạo khoản ngày ${formatDate(tx.date)}`;
}

function toInput(template: RecurringTemplate): RecurringInput {
  const { name, amount, categoryId, paidBy, dayOfMonth, startMonth } = template;
  return { name, amount, categoryId, paidBy, dayOfMonth, startMonth, active: template.active };
}

/** Chi tiêu định kỳ (admin): mẫu tự tạo khoản chi mỗi tháng (SPEC mục 6, 8). */
export function RecurringScreen() {
  const { data, users } = useReadyData();
  const now = useNow();
  const [editing, setEditing] = useState<RecurringTemplate | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RecurringTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const templates = active(data.recurring).sort(
    (a, b) => a.dayOfMonth - b.dayOfMonth || a.name.localeCompare(b.name, 'vi'),
  );
  const categoriesById = new Map(data.categories.map((c) => [c.id, c]));
  const usersById = new Map(users.map((u) => [u.id, u]));

  function run(action: () => void) {
    try {
      action();
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Chi tiêu định kỳ"
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus size={16} aria-hidden="true" />
            Thêm khoản định kỳ
          </Button>
        }
      />
      <p className={styles.lead}>
        Mỗi mẫu đang bật tự tạo một khoản chi vào ngày đã chọn của tháng hiện tại, khi mở app và sau
        mỗi lần đồng bộ. Không tạo bù cho các tháng trước. Sửa mẫu không đổi khoản đã tạo của tháng
        này; nếu cần, sửa khoản đó trong màn hình Khoản chi. Ngân sách của danh mục ở màn hình Ngân
        sách bằng tổng các mẫu đang bật của danh mục đó.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Card>
        {templates.length === 0 ? (
          <p className={styles.empty}>Chưa có khoản định kỳ nào, ví dụ tiền nhà, internet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Danh mục</th>
                <th className={styles.num}>Số tiền</th>
                <th>Người trả</th>
                <th className={styles.num}>Ngày</th>
                <th>Tháng này</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className={template.active ? undefined : styles.off}>
                  <td className={styles.name}>{template.name}</td>
                  <td>
                    <CategoryLabel category={categoriesById.get(template.categoryId)} />
                  </td>
                  <td className={styles.num}>{formatYen(template.amount)}</td>
                  <td>
                    <UserName user={usersById.get(template.paidBy)} />
                  </td>
                  <td className={styles.num}>{template.dayOfMonth}</td>
                  <td className={styles.status}>{currentMonthStatus(template, data, now)}</td>
                  <td className={styles.actions}>
                    <Button
                      size="sm"
                      onClick={() =>
                        run(() =>
                          useDataStore.getState().updateRecurring(template.id, {
                            ...toInput(template),
                            active: !template.active,
                          }),
                        )
                      }
                    >
                      {template.active ? 'Tắt' : 'Bật'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(template)}>
                      Sửa
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(template)}>
                      Xóa
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <RecurringEditor
          template={editing === 'new' ? null : editing}
          initial={editing === 'new' ? null : toInput(editing)}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa khoản định kỳ?"
          confirmLabel="Xóa"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            run(() => useDataStore.getState().deleteRecurring(deleting.id));
            setDeleting(null);
          }}
        >
          Xóa mẫu “{deleting.name}”? Các khoản đã tạo từ mẫu này vẫn giữ nguyên; từ tháng sau không
          tạo khoản mới nữa.
          {deleting.active &&
            ' Ngân sách của danh mục được tính lại theo các mẫu còn lại; không còn mẫu nào thì để trống.'}
        </ConfirmDialog>
      )}
    </>
  );
}
