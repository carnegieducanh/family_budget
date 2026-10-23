import { useSyncStore } from '../state/syncStore';
import { useNow } from '../state/useNow';
import { syncNow } from '../sync/appSync';
import { describeSyncStatus } from '../sync/syncStatus';
import { Button } from './Button';
import styles from './SyncIndicator.module.scss';

/** Trạng thái sync ở góc dưới sidebar, kèm nút "Sync ngay". */
export function SyncIndicator() {
  const running = useSyncStore((s) => s.running);
  const last = useSyncStore((s) => s.last);
  const lastSuccessAt = useSyncStore((s) => s.lastSuccessAt);
  const now = useNow();
  const view = describeSyncStatus({ running, last, lastSuccessAt }, now);

  return (
    <div className={styles.sync}>
      <div role="status" className={`${styles.main} ${styles[view.main.tone]}`}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.text} title={view.main.text}>
          {view.main.text}
        </span>
      </div>
      {view.extra.map((line) => (
        <div key={line.text} className={`${styles.extra} ${styles[line.tone]}`}>
          {line.text}
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className={styles.button}
        disabled={running}
        onClick={() => void syncNow()}
      >
        ⟳ Sync ngay
      </Button>
    </div>
  );
}
