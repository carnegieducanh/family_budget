import { CircleCheck, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useDataStore } from '../state/dataStore';
import { useSyncStore } from '../state/syncStore';
import { useUiStore } from '../state/uiStore';
import { useNow } from '../state/useNow';
import { syncNow } from '../sync/appSync';
import { describeSyncStatus } from '../sync/syncStatus';
import styles from './SyncButton.module.scss';

/**
 * Trạng thái sync ở thanh trên của bản web. Đang sync: mũi tên xoay kèm chữ "Đang sync"; lượt
 * sync gần nhất xong: "Đã sync" có dấu tích trên nền xanh nhạt (nảy nhẹ một lần lúc vừa xong);
 * có lỗi: tam giác; chưa kết nối: đám mây gạch. Bấm để sync ngay; có lỗi hoặc chưa kết nối thì
 * mở Cài đặt để đọc lý do (điện thoại không có tooltip).
 */
export function SyncButton() {
  const connected = useDataStore((s) => Boolean(s.settings?.syncFolder && s.settings.syncKey));
  const running = useSyncStore((s) => s.running);
  const last = useSyncStore((s) => s.last);
  const lastSuccessAt = useSyncStore((s) => s.lastSuccessAt);
  const now = useNow();
  const openSettings = () => useUiStore.getState().setScreen('settings');

  if (!connected) {
    return (
      <button
        type="button"
        className={`${styles.button} ${styles.muted}`}
        aria-label="Chưa kết nối Google Drive. Mở Cài đặt"
        title="Chưa kết nối Google Drive"
        onClick={openSettings}
      >
        <CloudOff size={20} aria-hidden="true" />
      </button>
    );
  }

  const status = describeSyncStatus({ running, last, lastSuccessAt }, now);
  const tone = status.main.tone;
  const problem = tone === 'error' || tone === 'warning';
  const synced = !running && !problem && last?.kind === 'ok';
  const text = status.main.text.replace(/\.$/, '');

  if (running || synced) {
    // Cùng một nút từ lúc đang sync tới lúc xong: thêm class `done` thì hiệu ứng nảy chạy lại.
    return (
      <button
        type="button"
        className={synced ? `${styles.pill} ${styles.done}` : styles.pill}
        aria-label={`${text}. Sync ngay`}
        title={status.main.text}
        disabled={running}
        onClick={() => void syncNow()}
      >
        {running ? (
          <RefreshCw size={16} className={styles.spin} aria-hidden="true" />
        ) : (
          <CircleCheck size={16} aria-hidden="true" />
        )}
        <span aria-hidden="true">{running ? 'Đang sync' : 'Đã sync'}</span>
      </button>
    );
  }

  const Icon = problem ? TriangleAlert : RefreshCw;
  return (
    <button
      type="button"
      className={`${styles.button} ${styles[tone]}`}
      aria-label={problem ? `${text}. Mở Cài đặt` : `${text}. Sync ngay`}
      title={status.main.text}
      onClick={problem ? openSettings : () => void syncNow()}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
