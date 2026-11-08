import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { FontSizeSwitcher } from '../components/FontSizeSwitcher';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { formatDateTime, formatTimeAgo } from '../core/month';
import { UsersSettings } from '../features/settings/UsersSettings';
import { useDataStore, useReadyData } from '../state/dataStore';
import { useSyncStore } from '../state/syncStore';
import { useNow } from '../state/useNow';
import { syncNow } from '../sync/appSync';
import { describeSyncStatus, remoteDeviceName } from '../sync/syncStatus';
import { ConnectionFields } from './ConnectionFields';
import { connectScript, parseConnection } from './scriptConnect';
import styles from '../features/settings/SettingsScreen.module.scss';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Cài đặt của bản web: giao diện, người dùng, đồng bộ. Danh mục, ngân sách, định kỳ, backup và
 * CSV làm trên app máy tính.
 */
export function WebSettingsScreen() {
  const deviceId = useDataStore((s) => s.settings?.deviceId);
  return (
    <div className={styles.page}>
      <PageHeader title="Cài đặt" />
      <div className={styles.cards}>
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
        <UsersSettings />
        <SyncSettings />
        <Card title="Máy này">
          <dl className={styles.rows}>
            <dt>Mã máy</dt>
            <dd>
              <code className={styles.path}>{deviceId}</code>
            </dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function SyncSettings() {
  const { data } = useReadyData();
  const settings = useDataStore((s) => s.settings);
  const running = useSyncStore((s) => s.running);
  const last = useSyncStore((s) => s.last);
  const lastSuccessAt = useSyncStore((s) => s.lastSuccessAt);
  const now = useNow();
  const [editing, setEditing] = useState(false);

  const connected = Boolean(settings?.syncFolder && settings.syncKey);
  const status = describeSyncStatus({ running, last, lastSuccessAt }, now);
  const remotes = last?.kind === 'ok' ? last.remotes : [];
  const problems = last?.kind === 'ok' ? last.problems : [];

  return (
    <Card title="Đồng bộ qua Google Drive">
      <dl className={styles.rows}>
        <dt>Trạng thái</dt>
        <dd>
          <div className={styles[status.main.tone]}>
            {connected ? status.main.text : 'Chưa kết nối Google Drive'}
          </div>
          {connected &&
            status.extra.map((line) => (
              <div key={line.text} className={`${styles.small} ${styles[line.tone]}`}>
                {line.text}
              </div>
            ))}
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="primary"
              disabled={running || !connected}
              onClick={() => void syncNow()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Sync ngay
            </Button>
            <Button size="sm" onClick={() => setEditing(true)}>
              {connected ? 'Đổi kết nối...' : 'Kết nối...'}
            </Button>
          </div>
          <p className={styles.hint}>
            App sync khi mở app, khi quay lại app, mỗi {settings?.syncIntervalMin ?? 5} phút, và 2
            giây sau mỗi thay đổi.
          </p>
        </dd>

        {last?.kind === 'ok' && (
          <>
            <dt>Máy khác</dt>
            <dd>
              {remotes.length === 0 ? (
                <span className={styles.muted}>Chưa thấy dữ liệu từ máy khác.</span>
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
            </dd>
          </>
        )}
      </dl>
      {editing && <ConnectDialog onClose={() => setEditing(false)} />}
    </Card>
  );
}

/** Đổi link / mã kết nối (admin triển khai lại script, hoặc đổi mã). */
function ConnectDialog({ onClose }: { onClose: () => void }) {
  const settings = useDataStore((s) => s.settings);
  const [url, setUrl] = useState(settings?.syncFolder ?? '');
  const [secret, setSecret] = useState(settings?.syncKey ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await connectScript(parseConnection(url, secret));
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Kết nối Google Drive"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={busy || !url.trim() || !secret.trim()}
          >
            {busy ? 'Đang kiểm tra...' : 'Kết nối'}
          </Button>
        </>
      }
    >
      <div className={styles.cards}>
        <ConnectionFields
          url={url}
          secret={secret}
          disabled={busy}
          onUrl={setUrl}
          onSecret={setSecret}
        />
        {error && <p className={styles.errorMessage}>{error}</p>}
      </div>
    </Modal>
  );
}
