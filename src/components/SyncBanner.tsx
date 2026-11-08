import { useSyncStore } from '../state/syncStore';
import { useUiStore } from '../state/uiStore';
import { Button } from './Button';
import styles from './SyncBanner.module.scss';

/** Cảnh báo sync cần người dùng xử lý; các cảnh báo nhẹ chỉ hiện ở góc sidebar. */
export function SyncBanner() {
  const last = useSyncStore((s) => s.last);
  const screen = useUiStore((s) => s.screen);
  if (last?.kind === 'schema-too-new') {
    return (
      <div className={styles.banner} role="alert">
        Máy kia đang dùng bản mới hơn, hãy cập nhật app. Đồng bộ tạm dừng cho đến khi cập nhật.
      </div>
    );
  }
  const reasons = last?.kind === 'ok' ? last.problems.map((p) => p.reason) : [];
  if (reasons.includes('encrypted') || reasons.includes('decrypt-failed')) {
    return (
      <div className={`${styles.banner} ${styles.warning}`} role="alert">
        <span>
          {reasons.includes('encrypted')
            ? 'Máy kia đã mã hóa dữ liệu trên Drive. Nhập mật khẩu chung ở Cài đặt → Mã hóa để tiếp tục nhận dữ liệu từ máy kia.'
            : 'Không giải mã được dữ liệu từ máy kia, kiểm tra mật khẩu ở Cài đặt → Mã hóa.'}
        </span>
        {screen !== 'settings' && (
          <Button size="sm" onClick={() => useUiStore.getState().setScreen('settings')}>
            Mở Cài đặt
          </Button>
        )}
      </div>
    );
  }
  if (last?.kind === 'ok' && last.clockSkew) {
    return (
      <div className={`${styles.banner} ${styles.warning}`} role="alert">
        Giờ trên hai máy lệch nhau. Hãy bật “Đặt giờ tự động” trên cả hai máy, nếu không bản sửa
        trên máy chạy nhanh giờ có thể đè bản sửa mới hơn trên máy kia.
      </div>
    );
  }
  return null;
}
