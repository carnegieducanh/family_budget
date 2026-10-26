import { useUpdateStore, type InstallState } from '../state/updateStore';
import { installUpdate } from '../update/appUpdate';
import { Button } from './Button';
import { Modal } from './Modal';
import { ReleaseNotesToggle } from './ReleaseNotes';
import styles from './UpdateDialog.module.scss';

/**
 * Popup giữa màn hình khi có bản mới (SPEC mục 8, 9). Chỉ báo ngắn gọn; nội dung cập nhật ẩn
 * sau "Xem chi tiết", xem lại được ở Cài đặt → Phiên bản app. Chỉ cài khi người dùng bấm
 * "Cập nhật"; "Để sau" (hoặc đóng popup) ẩn đến lần mở app sau.
 */
export function UpdateDialog() {
  const available = useUpdateStore((s) => s.available);
  const install = useUpdateStore((s) => s.install);
  const dismissed = useUpdateStore((s) => s.dismissedVersion);
  if (!available) return null;
  const busy = install.phase === 'downloading' || install.phase === 'installing';
  // Đã bấm "Để sau" thì chỉ hiện lại khi đang tải, cài (bấm "Cập nhật" ở Cài đặt).
  if (dismissed === available.version && !busy) return null;
  const version = available.version;

  function later() {
    if (!busy) useUpdateStore.setState({ dismissedVersion: version });
  }

  return (
    <Modal
      title="Có bản cập nhật mới"
      onClose={later}
      width={420}
      footer={
        !busy && (
          <>
            <Button onClick={later}>Để sau</Button>
            <Button variant="primary" onClick={() => void installUpdate()} autoFocus>
              {install.phase === 'failed' ? 'Thử lại' : 'Cập nhật'}
            </Button>
          </>
        )
      }
    >
      <div className={styles.body}>
        <p className={styles.lead}>
          Family Budget <strong>{version}</strong> đã sẵn sàng để cài.
        </p>
        <ReleaseNotesToggle notes={available.notes} label="Xem chi tiết" />
        <InstallStatus install={install} />
      </div>
    </Modal>
  );
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function InstallStatus({ install }: { install: InstallState }) {
  switch (install.phase) {
    case 'idle':
      return (
        <p className={styles.hint}>
          App sẽ tự khởi động lại sau khi cài. Dữ liệu trên máy không bị ảnh hưởng.
        </p>
      );
    case 'downloading': {
      const { downloaded, total } = install;
      const progress = total
        ? `${Math.min(100, Math.round((downloaded / total) * 100))}%`
        : formatMegabytes(downloaded);
      return <p className={styles.hint}>Đang tải bản cập nhật... {progress}</p>;
    }
    case 'installing':
      return <p className={styles.hint}>Đang cài đặt, app sẽ tự khởi động lại...</p>;
    case 'failed':
      return <p className={styles.error}>Không cập nhật được: {install.message}</p>;
  }
}
