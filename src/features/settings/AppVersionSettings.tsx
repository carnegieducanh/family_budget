import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { InstallStatus } from '../../components/UpdateBanner';
import { useUpdateStore } from '../../state/updateStore';
import { useNow } from '../../state/useNow';
import { checkForUpdate, installUpdate } from '../../update/appUpdate';
import { formatSyncTime } from '../../sync/syncStatus';
import styles from './SettingsScreen.module.scss';

/** Phiên bản app và nút "Kiểm tra cập nhật" (SPEC mục 8, màn hình 9). */
export function AppVersionSettings() {
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const checking = useUpdateStore((s) => s.checking);
  const available = useUpdateStore((s) => s.available);
  const lastCheck = useUpdateStore((s) => s.lastCheck);
  const install = useUpdateStore((s) => s.install);
  const now = useNow();
  const busy = install.phase === 'downloading' || install.phase === 'installing';

  function checkNow() {
    // Kiểm tra tay thì banner hiện lại, kể cả khi đã bấm "Để sau".
    useUpdateStore.setState({ dismissedVersion: null });
    void checkForUpdate();
  }

  return (
    <Card title="Phiên bản app">
      <dl className={styles.rows}>
        <dt>Đang dùng</dt>
        <dd>
          <code>{currentVersion ?? '...'}</code>
        </dd>

        <dt>Cập nhật</dt>
        <dd>
          {checking ? (
            <div className={styles.muted}>Đang kiểm tra...</div>
          ) : available ? (
            <>
              <div className={styles.ok}>Có phiên bản {available.version}</div>
              <InstallStatus install={install} />
            </>
          ) : lastCheck?.error ? (
            <>
              <div className={styles.warning}>Không kiểm tra được cập nhật.</div>
              <p className={styles.hint}>
                Kiểm tra kết nối mạng rồi thử lại. Chi tiết: {lastCheck.error}
              </p>
            </>
          ) : lastCheck ? (
            <div>Đang dùng bản mới nhất (kiểm tra lúc {formatSyncTime(lastCheck.at, now)}).</div>
          ) : (
            <div className={styles.muted}>Chưa kiểm tra.</div>
          )}
          <div className={styles.actions}>
            <Button size="sm" onClick={checkNow} disabled={checking || busy}>
              Kiểm tra cập nhật
            </Button>
            {available && (install.phase === 'idle' || install.phase === 'failed') && (
              <Button size="sm" variant="primary" onClick={() => void installUpdate()}>
                Cập nhật lên {available.version}
              </Button>
            )}
          </div>
          <p className={styles.hint}>
            App tự kiểm tra khi mở và mỗi 24 giờ, nhưng chỉ cài khi bạn bấm “Cập nhật”.
          </p>
        </dd>
      </dl>
    </Card>
  );
}
