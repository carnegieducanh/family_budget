import { useId, useState } from 'react';
import { exportCsv, transactionsForExport } from '../../core/csv';
import { Button } from '../../components/Button';
import { useReadyData } from '../../state/dataStore';
import { chooseFileToSave, writeTextFileTo } from '../../storage/files';
import styles from './data.module.scss';

type Message = { tone: 'ok' | 'error'; text: string };

/** Export CSV các khoản chi trong một khoảng tháng. Ai cũng dùng được (SPEC mục 7). */
export function CsvExport({ defaultMonth }: { defaultMonth: string }) {
  const { data } = useReadyData();
  const id = useId();
  const [from, setFrom] = useState(defaultMonth);
  const [to, setTo] = useState(defaultMonth);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const validRange = from !== '' && to !== '' && from <= to;
  const count = validRange ? transactionsForExport(data, from, to).length : 0;

  async function save() {
    setMessage(null);
    setBusy(true);
    try {
      const name = from === to ? `family-budget-${from}.csv` : `family-budget-${from}_${to}.csv`;
      const path = await chooseFileToSave('csv', 'Lưu file CSV', name);
      if (!path) return;
      await writeTextFileTo(path, exportCsv(data, from, to));
      setMessage({ tone: 'ok', text: `Đã lưu ${count} khoản chi vào ${path}` });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.block}>
      <div className={styles.controls}>
        <label className={styles.field} htmlFor={`${id}-from`}>
          <span>Từ tháng</span>
          <input
            id={`${id}-from`}
            type="month"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className={styles.field} htmlFor={`${id}-to`}>
          <span>Đến tháng</span>
          <input id={`${id}-to`} type="month" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <Button variant="primary" onClick={() => void save()} disabled={!validRange || busy}>
          Export CSV...
        </Button>
        <span className={styles.muted}>
          {validRange ? `${count} khoản chi` : 'Tháng bắt đầu phải trước tháng kết thúc'}
        </span>
      </div>
      <p className={styles.hint}>
        File UTF-8 có cột date, amount, category, note, paidBy, createdBy; mở được bằng Excel và
        nhập lại được vào app.
      </p>
      {message && (
        <p className={message.tone === 'ok' ? styles.ok : styles.error} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
