import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSyncStore } from '../state/syncStore';
import { useNow } from '../state/useNow';
import { pickSyncFolder } from '../storage/driveFolderAdapter';
import { connectSyncFolder, syncNow } from '../sync/appSync';
import { describeSyncStatus } from '../sync/syncStatus';
import { Button } from './Button';
import styles from './SyncIndicator.module.scss';

/**
 * Trạng thái sync ở góc dưới sidebar, kèm nút "Sync ngay". Khi chưa kết nối thư mục Drive,
 * bấm vào dòng trạng thái để chọn thư mục ngay, không phải vào Cài đặt.
 * `compact` (sidebar chỉ còn icon): một nút sync có chấm trạng thái, nội dung ở tooltip.
 */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const running = useSyncStore((s) => s.running);
  const last = useSyncStore((s) => s.last);
  const lastSuccessAt = useSyncStore((s) => s.lastSuccessAt);
  const now = useNow();
  const view = describeSyncStatus({ running, last, lastSuccessAt }, now);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const notConnected = !running && last?.kind === 'not-configured';

  async function connect() {
    setConnectError(null);
    try {
      const folder = await pickSyncFolder();
      if (!folder) return;
      setConnecting(true);
      await connectSyncFolder(folder);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

  if (compact) {
    const lines = [view.main, ...view.extra];
    if (notConnected && connectError) lines.push({ text: connectError, tone: 'error' });
    // Chấm lấy màu của dòng nặng nhất, vì các dòng phụ chỉ còn trong tooltip.
    const tone =
      (['error', 'warning'] as const).find((t) => lines.some((line) => line.tone === t)) ??
      view.main.tone;
    const action = notConnected ? 'Bấm để chọn thư mục Google Drive' : 'Bấm để sync ngay';
    return (
      <button
        type="button"
        className={`${styles.compact} ${styles[tone]}`}
        disabled={running || connecting}
        title={[...lines.map((line) => line.text), action].join('\n')}
        onClick={() => void (notConnected ? connect() : syncNow())}
      >
        <RefreshCw size={18} className={running ? styles.spin : undefined} aria-hidden="true" />
        <span className={styles.dot} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className={styles.sync}>
      <div role="status" className={`${styles.main} ${styles[view.main.tone]}`}>
        <span className={styles.dot} aria-hidden="true" />
        {notConnected ? (
          <button
            type="button"
            className={styles.connect}
            disabled={connecting}
            title="Chọn thư mục Google Drive để đồng bộ"
            onClick={() => void connect()}
          >
            {connecting ? 'Đang kiểm tra thư mục...' : view.main.text}
          </button>
        ) : (
          <span className={styles.text} title={view.main.text}>
            {view.main.text}
          </span>
        )}
      </div>
      {notConnected && connectError && (
        <div className={`${styles.extra} ${styles.error}`}>{connectError}</div>
      )}
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
        <RefreshCw size={14} className={running ? styles.spin : undefined} aria-hidden="true" />
        Sync ngay
      </Button>
    </div>
  );
}
