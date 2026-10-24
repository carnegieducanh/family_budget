import { useUpdateStore, type InstallState } from '../state/updateStore';
import { installUpdate } from '../update/appUpdate';
import { Button } from './Button';
import styles from './UpdateBanner.module.scss';

/** Banner ở trên cùng khi có bản mới (SPEC mục 8, 9). Chỉ cài khi người dùng bấm "Cập nhật". */
export function UpdateBanner() {
  const available = useUpdateStore((s) => s.available);
  const install = useUpdateStore((s) => s.install);
  const dismissed = useUpdateStore((s) => s.dismissedVersion);
  if (!available) return null;
  if (dismissed === available.version && install.phase === 'idle') return null;
  const canStart = install.phase === 'idle' || install.phase === 'failed';

  return (
    <div className={styles.banner} role="status">
      <div className={styles.body}>
        <strong>Có phiên bản {available.version}</strong>
        {available.notes && <p className={styles.notes}>{available.notes}</p>}
        <InstallStatus install={install} />
      </div>
      {canStart && (
        <div className={styles.actions}>
          <Button size="sm" variant="primary" onClick={() => void installUpdate()}>
            {install.phase === 'failed' ? 'Thử lại' : 'Cập nhật'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => useUpdateStore.setState({ dismissedVersion: available.version })}
          >
            Để sau
          </Button>
        </div>
      )}
    </div>
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
