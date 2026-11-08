import { CloudCheck, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useDataStore } from '../state/dataStore';
import { useSyncStore } from '../state/syncStore';
import { useUiStore } from '../state/uiStore';
import { useNow } from '../state/useNow';
import { syncNow } from '../sync/appSync';
import { describeSyncStatus } from '../sync/syncStatus';
import styles from './SyncButton.module.scss';

/**
 * Trạng thái sync ở thanh trên của bản web: mũi tên xoay khi đang sync, đám mây có dấu tích khi
 * lượt sync gần nhất xong (nảy nhẹ một lần lúc vừa xong), tam giác khi có lỗi. Bấm để sync ngay;
 * có lỗi hoặc chưa kết nối thì mở Cài đặt để đọc lý do (điện thoại không có tooltip).
 */
export function SyncButton() {
  const connected = useDataStore((s) => Boolean(s.settings?.syncFolder && s.settings.syncKey));
  const running = useSyncStore((s) => s.running);
  const last = useSyncStore((s) => s.last);
  const lastSuccessAt = useSyncStore((s) => s.lastSuccessAt);
  const now = useNow();

  if (!connected) {
    return (
      <button
        type="button"
        className={`${styles.button} ${styles.muted}`}
        aria-label="Chưa kết nối Google Drive. Mở Cài đặt"
        title="Chưa kết nối Google Drive"
        onClick={() => useUiStore.getState().setScreen('settings')}
      >
        <CloudOff size={20} aria-hidden="true" />
      </button>
    );
  }

  const status = describeSyncStatus({ running, last, lastSuccessAt }, now);
  const tone = status.main.tone;
  const problem = tone === 'error' || tone === 'warning';
  const synced = !running && !problem && last?.kind === 'ok';
  // Đổi loại icon thì React dựng lại icon, nên hiệu ứng nảy của `done` chạy lại mỗi lần sync xong.
  const Icon = running ? RefreshCw : problem ? TriangleAlert : synced ? CloudCheck : RefreshCw;
  const text = status.main.text.replace(/\.$/, '');
  return (
    <button
      type="button"
      className={`${styles.button} ${styles[tone]}`}
      aria-label={problem ? `${text}. Mở Cài đặt` : `${text}. Sync ngay`}
      title={status.main.text}
      disabled={running}
      onClick={() => (problem ? useUiStore.getState().setScreen('settings') : void syncNow())}
    >
      <Icon
        size={20}
        className={running ? styles.spin : synced ? styles.done : undefined}
        aria-hidden="true"
      />
    </button>
  );
}
