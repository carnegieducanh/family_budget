import { useState } from 'react';
import { prepareImport, type ImportPreview, type ImportRow } from '../../core/csv';
import { formatYen } from '../../core/money';
import { formatDate } from '../../core/month';
import { Button } from '../../components/Button';
import { CategoryLabel } from '../../components/CategoryLabel';
import { Modal } from '../../components/Modal';
import { useSmoothScroll } from '../../components/useSmoothScroll';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { chooseFileToOpen, readUtf8File } from '../../storage/files';
import styles from './data.module.scss';

type Message = { tone: 'ok' | 'error'; text: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Import CSV (admin): chọn file, xem trước từng dòng, rồi mới ghi (SPEC mục 8). */
export function CsvImport() {
  const [file, setFile] = useState<{ path: string; text: string; preview: ImportPreview } | null>(
    null,
  );
  const [message, setMessage] = useState<Message | null>(null);

  async function choose() {
    setMessage(null);
    try {
      const path = await chooseFileToOpen('csv', 'Chọn file CSV để nhập');
      if (!path) return;
      const text = await readUtf8File(path);
      const preview = prepareImport(text, useDataStore.getState().context());
      setFile({ path, text, preview });
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  }

  return (
    <div className={styles.block}>
      <div className={styles.controls}>
        <Button onClick={() => void choose()}>Import CSV...</Button>
      </div>
      <p className={styles.hint}>
        Dòng đầu là tên cột như file export. Danh mục và người dùng ghi bằng tên. Dòng trùng (cùng
        ngày, số tiền, danh mục, ghi chú) được bỏ qua. App lưu một bản backup trước khi nhập.
      </p>
      {message && (
        <p className={message.tone === 'ok' ? styles.ok : styles.error} role="status">
          {message.text}
        </p>
      )}
      {file && (
        <ImportPreviewDialog
          path={file.path}
          preview={file.preview}
          onCancel={() => setFile(null)}
          onConfirm={async () => {
            try {
              const count = await useDataStore.getState().importCsv(file.text);
              setMessage({ tone: 'ok', text: `Đã nhập ${count} khoản chi.` });
            } catch (e) {
              setMessage({ tone: 'error', text: errorMessage(e) });
            }
            setFile(null);
          }}
        />
      )}
    </div>
  );
}

const STATUS_LABEL: Record<ImportRow['status'], string> = {
  new: 'Mới',
  duplicate: 'Trùng, bỏ qua',
  error: 'Lỗi',
};

function ImportPreviewDialog({
  path,
  preview,
  onCancel,
  onConfirm,
}: {
  path: string;
  preview: ImportPreview;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { data } = useReadyData();
  const [saving, setSaving] = useState(false);
  const [tableScrollRef] = useSmoothScroll();
  const categoriesById = new Map(data.categories.map((c) => [c.id, c]));
  const usersById = new Map(data.users.map((u) => [u.id, u]));
  const statusClass = {
    new: styles.statusNew,
    duplicate: styles.statusDuplicate,
    error: styles.statusError,
  };

  return (
    <Modal
      title="Xem trước import CSV"
      onClose={onCancel}
      width={760}
      footer={
        <>
          <Button onClick={onCancel} disabled={saving}>
            Hủy
          </Button>
          <Button
            variant="primary"
            disabled={saving || preview.newCount === 0}
            onClick={() => {
              setSaving(true);
              void onConfirm();
            }}
          >
            {saving ? 'Đang nhập...' : `Nhập ${preview.newCount} khoản`}
          </Button>
        </>
      }
    >
      <p className={styles.summary}>
        <code>{path}</code>
        <br />
        {preview.newCount} khoản mới · {preview.duplicateCount} dòng trùng (bỏ qua) ·{' '}
        {preview.errorCount} dòng lỗi
        {preview.errorCount > 0 && ' (không nhập; sửa file rồi import lại các dòng này)'}
      </p>
      {preview.rows.length === 0 ? (
        <p className={styles.hint}>File không có dòng dữ liệu nào.</p>
      ) : (
        <table ref={tableScrollRef} className={styles.previewTable}>
          <thead>
            <tr>
              <th>Dòng</th>
              <th>Trạng thái</th>
              <th>Ngày</th>
              <th className={styles.num}>Số tiền</th>
              <th>Danh mục</th>
              <th>Ghi chú</th>
              <th>Người trả</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.line}>
                <td className={styles.num}>{row.line}</td>
                <td className={statusClass[row.status]}>{STATUS_LABEL[row.status]}</td>
                {row.status === 'error' ? (
                  <td colSpan={5} className={styles.statusError}>
                    {row.message}
                  </td>
                ) : (
                  <>
                    <td>{formatDate(row.input.date)}</td>
                    <td className={styles.num}>{formatYen(row.input.amount)}</td>
                    <td>
                      <CategoryLabel category={categoriesById.get(row.input.categoryId)} />
                    </td>
                    <td>{row.input.note}</td>
                    <td>{usersById.get(row.input.paidBy)?.name}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
