import { useState } from 'react';
import { formatDate } from '../../core/month';
import { planRestore, summarizeData } from '../../core/restore';
import type { DataFile } from '../../core/types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useDataStore } from '../../state/dataStore';
import styles from './data.module.scss';

/**
 * Xem trước rồi xác nhận khôi phục một bản backup (SPEC mục 9): số khoản chi, khoảng
 * ngày, và số bản ghi sẽ thay đổi.
 */
export function RestoreDialog({
  source,
  snapshot,
  onClose,
  onDone,
}: {
  source: string;
  snapshot: DataFile;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = summarizeData(snapshot);
  let plan: ReturnType<typeof planRestore> | null = null;
  let planError: string | null = null;
  try {
    const ctx = useDataStore.getState().context();
    plan = planRestore(ctx.data, snapshot, ctx.userId, ctx.now);
  } catch (e) {
    planError = e instanceof Error ? e.message : String(e);
  }
  const changes = plan ? plan.rewritten + plan.removed : 0;

  async function confirm() {
    setSaving(true);
    try {
      const result = await useDataStore.getState().restore(snapshot);
      onDone(
        `Đã khôi phục bản backup ${source} (${result.rewritten} bản ghi ghi lại, ${result.removed} bản ghi xóa).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Khôi phục backup?"
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={saving || !plan || changes === 0}
            onClick={() => void confirm()}
          >
            {saving ? 'Đang khôi phục...' : 'Khôi phục'}
          </Button>
        </>
      }
    >
      <p className={styles.summary}>
        Bản backup <strong>{source}</strong> có {summary.transactions} khoản chi
        {summary.firstDate && summary.lastDate && (
          <>
            , từ {formatDate(summary.firstDate)} đến {formatDate(summary.lastDate)}
          </>
        )}
        .
      </p>
      {planError ? (
        <p className={styles.error}>{planError}</p>
      ) : changes === 0 ? (
        <p className={styles.hint}>Dữ liệu hiện tại đã giống hệt bản backup này.</p>
      ) : (
        <p className={styles.summary}>
          Khôi phục sẽ ghi lại {plan?.rewritten} bản ghi và xóa {plan?.removed} bản ghi để dữ liệu
          trở về đúng như bản backup. Máy kia nhận bản khôi phục ở lần đồng bộ sau. App lưu một bản
          backup của dữ liệu hiện tại trước khi khôi phục.
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </Modal>
  );
}
