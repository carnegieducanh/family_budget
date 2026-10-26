import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDateTime, formatTimeAgo } from '../../core/month';
import { can } from '../../core/permissions';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FontSizeSwitcher } from '../../components/FontSizeSwitcher';
import { PageHeader } from '../../components/PageHeader';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { useSyncStore } from '../../state/syncStore';
import { useUiStore } from '../../state/uiStore';
import { useNow } from '../../state/useNow';
import { getBackupDir } from '../../storage/backup';
import { pickSyncFolder, resolveDataDir } from '../../storage/driveFolderAdapter';
import { getDataFilePath } from '../../storage/localStore';
import { connectSyncFolder, syncNow } from '../../sync/appSync';
import { describeSyncStatus, remoteDeviceName } from '../../sync/syncStatus';
import { BackupPanel } from '../data/BackupPanel';
import { CsvExport } from '../data/CsvExport';
import { CsvImport } from '../data/CsvImport';
import { AppVersionSettings } from './AppVersionSettings';
import { EncryptionSettings } from './EncryptionSettings';
import styles from './SettingsScreen.module.scss';
import { UsersSettings } from './UsersSettings';

const INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30, 60];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Cài đặt (SPEC mục 8, màn hình 9). */
export function SettingsScreen() {
  const { me } = useReadyData();
  const month = useUiStore((s) => s.month);
  return (
    <div className={styles.page}>
      <PageHeader title="Cài đặt" />
      <div className={styles.cards}>
        <AppearanceSettings />
        <UsersSettings />
        <SyncSettings />
        <EncryptionSettings />
        <Card title="Backup">
          <BackupPanel />
        </Card>
        <Card title="Import / export CSV">
          <CsvExport defaultMonth={month} />
          {can(me, 'csv:import') && (
            <div className={styles.section}>
              <CsvImport />
            </div>
          )}
        </Card>
        <DeviceInfo />
        <AppVersionSettings />
      </div>
    </div>
  );
}

function AppearanceSettings() {
  return (
    <Card title="Giao diện">
      <dl className={styles.rows}>
        <dt>Theme</dt>
        <dd>
          <ThemeSwitcher />
        </dd>
        <dt>Cỡ chữ</dt>
        <dd>
          <FontSizeSwitcher />
        </dd>
      </dl>
    </Card>
  );
}

function SyncSettings() {
  const { data } = useReadyData();
  const settings = useDataStore((s) => s.settings);
  const running = useSyncStore((s) => s.running);
  const last = useSyncStore((s) => s.last);
  const lastSuccessAt = useSyncStore((s) => s.lastSuccessAt);
  const now = useNow();
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const syncFolder = settings?.syncFolder ?? null;
  useEffect(() => {
    if (!syncFolder) return;
    let cancelled = false;
    resolveDataDir(syncFolder).then(
      (dir) => !cancelled && setDataDir(dir),
      () => !cancelled && setDataDir(null),
    );
    return () => {
      cancelled = true;
    };
  }, [syncFolder]);

  if (!settings) return null;
  const status = describeSyncStatus({ running, last, lastSuccessAt }, now);

  async function chooseFolder() {
    setError(null);
    try {
      const folder = await pickSyncFolder(syncFolder);
      if (!folder) return;
      setBusy(true);
      await connectSyncFolder(folder);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setConfirmDisconnect(false);
    try {
      await useDataStore.getState().updateSettings({ syncFolder: null });
      void syncNow();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function changeInterval(minutes: number) {
    try {
      await useDataStore.getState().updateSettings({ syncIntervalMin: minutes });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const remotes = last?.kind === 'ok' ? last.remotes : [];
  const problems = last?.kind === 'ok' ? last.problems : [];

  return (
    <Card title="Đồng bộ qua Google Drive">
      <dl className={styles.rows}>
        <dt>Thư mục Drive</dt>
        <dd>
          {syncFolder ? (
            <code className={styles.path}>{syncFolder}</code>
          ) : (
            <span className={styles.muted}>Chưa chọn thư mục</span>
          )}
          <div className={styles.actions}>
            <Button size="sm" onClick={() => void chooseFolder()} disabled={busy}>
              {busy ? 'Đang kiểm tra...' : syncFolder ? 'Đổi thư mục...' : 'Chọn thư mục...'}
            </Button>
            {syncFolder && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(true)}>
                Ngắt kết nối
              </Button>
            )}
          </div>
          {error && <p className={styles.errorMessage}>{error}</p>}
        </dd>

        {syncFolder && dataDir && (
          <>
            <dt>File đồng bộ nằm ở</dt>
            <dd>
              <code className={styles.path}>{dataDir}</code>
            </dd>
          </>
        )}

        <dt>
          <label htmlFor="sync-interval">Chu kỳ sync</label>
        </dt>
        <dd>
          <select
            id="sync-interval"
            value={settings.syncIntervalMin}
            onChange={(e) => void changeInterval(Number(e.target.value))}
          >
            {[...new Set([...INTERVAL_OPTIONS, settings.syncIntervalMin])]
              .sort((a, b) => a - b)
              .map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} phút
                </option>
              ))}
          </select>
          <p className={styles.hint}>
            Ngoài ra app còn sync khi mở app, khi quay lại cửa sổ app, và 10 giây sau mỗi thay đổi.
          </p>
        </dd>

        <dt>Trạng thái</dt>
        <dd>
          <div className={styles[status.main.tone]}>{status.main.text}</div>
          {status.extra.map((line) => (
            <div key={line.text} className={`${styles.small} ${styles[line.tone]}`}>
              {line.text}
            </div>
          ))}
          {last?.kind === 'folder-missing' && (
            <p className={styles.hint}>
              Kiểm tra Google Drive for Desktop đang chạy và thư mục vẫn còn, hoặc chọn lại thư mục.
            </p>
          )}
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="primary"
              disabled={running || !syncFolder}
              onClick={() => void syncNow()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Sync ngay
            </Button>
          </div>
        </dd>

        {last?.kind === 'ok' && (
          <>
            <dt>Máy khác</dt>
            <dd>
              {remotes.length === 0 ? (
                <span className={styles.muted}>Chưa thấy dữ liệu từ máy kia.</span>
              ) : (
                <ul className={styles.list}>
                  {remotes.map((remote) => (
                    <li key={remote.name}>
                      {remoteDeviceName(remote, data.users, remotes)} ghi dữ liệu lúc{' '}
                      {formatDateTime(remote.writtenAt)} ({formatTimeAgo(remote.writtenAt, now)})
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </>
        )}

        {problems.length > 0 && (
          <>
            <dt className={styles.warning}>File bị bỏ qua</dt>
            <dd>
              <ul className={styles.list}>
                {problems.map((problem) => (
                  <li key={problem.name}>
                    <code>{problem.name}</code>: {problem.message}
                  </li>
                ))}
              </ul>
              <p className={styles.hint}>
                Dữ liệu trên máy này không bị ảnh hưởng. Nếu file đang được Google Drive tải về dở,
                lượt sync sau sẽ đọc lại.
              </p>
            </dd>
          </>
        )}
      </dl>

      {confirmDisconnect && (
        <ConfirmDialog
          title="Ngắt kết nối thư mục Drive?"
          confirmLabel="Ngắt kết nối"
          onCancel={() => setConfirmDisconnect(false)}
          onConfirm={() => void disconnect()}
        >
          Máy này sẽ ngừng đồng bộ với máy kia. Dữ liệu trên máy này và các file trong thư mục Drive
          vẫn giữ nguyên; bạn có thể kết nối lại bất cứ lúc nào.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function DeviceInfo() {
  const deviceId = useDataStore((s) => s.settings?.deviceId);
  const [paths, setPaths] = useState<{ data: string; backups: string } | null>(null);

  useEffect(() => {
    Promise.all([getDataFilePath(), getBackupDir()]).then(
      ([data, backups]) => setPaths({ data, backups }),
      () => setPaths(null),
    );
  }, []);

  return (
    <Card title="Máy này">
      <dl className={styles.rows}>
        <dt>Mã máy</dt>
        <dd>
          <code className={styles.path}>{deviceId}</code>
        </dd>
        {paths && (
          <>
            <dt>Dữ liệu trên máy</dt>
            <dd>
              <code className={styles.path}>{paths.data}</code>
            </dd>
            <dt>Thư mục backup</dt>
            <dd>
              <code className={styles.path}>{paths.backups}</code>
              <p className={styles.hint}>Danh sách và cách khôi phục ở mục Backup phía trên.</p>
            </dd>
          </>
        )}
      </dl>
    </Card>
  );
}
