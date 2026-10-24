import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { can } from '../../core/permissions';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { useSyncStore } from '../../state/syncStore';
import { MIN_PASSWORD_LENGTH } from '../../storage/crypto';
import { encryptedContents, inspectFolder, syncNow } from '../../sync/appSync';
import styles from './SettingsScreen.module.scss';

type Dialog = 'set' | 'enter' | 'disable' | null;
type Message = { tone: 'ok' | 'error'; text: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Mã hóa file trên Drive (SPEC mục 9): admin đặt mật khẩu, máy thứ hai nhập cùng mật khẩu.
 * Chỉ file của máy này trên Drive được mã hóa; dữ liệu trên máy giữ dạng thường.
 */
export function EncryptionSettings() {
  const { me } = useReadyData();
  const settings = useDataStore((s) => s.settings);
  const last = useSyncStore((s) => s.last);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState<Message | null>(null);
  if (!settings) return null;

  const manage = can(me, 'encryption:manage');
  const { enabled, keyB64 } = settings.encryption;
  const { syncFolder, deviceId } = settings;
  const reasons = last?.kind === 'ok' ? last.problems.map((p) => p.reason) : [];
  const needsKey = reasons.includes('encrypted');
  const wrongKey = reasons.includes('decrypt-failed');
  const remotes = last?.kind === 'ok' ? last.remotes : [];

  function finish(text: string) {
    setDialog(null);
    setMessage({ tone: 'ok', text });
    void syncNow();
  }

  async function setPassword(password: string, confirm: string) {
    await useDataStore.getState().setEncryptionPassword(password, confirm);
    finish(
      enabled
        ? 'Đã đổi mật khẩu. Trên máy kia, vào Cài đặt → Mã hóa và nhập mật khẩu mới.'
        : 'Đã bật mã hóa. Trên máy kia, vào Cài đặt → Mã hóa và nhập cùng mật khẩu.',
    );
  }

  async function enterPassword(password: string) {
    if (!syncFolder) throw new Error('Chưa chọn thư mục Drive.');
    const contents = await inspectFolder(syncFolder, deviceId);
    const envelopes = encryptedContents(contents.rawFiles);
    await useDataStore.getState().enterEncryptionPassword(password, envelopes);
    finish('Đã lưu mật khẩu. Máy này đang đồng bộ lại với máy kia.');
  }

  async function disable() {
    setDialog(null);
    try {
      await useDataStore.getState().disableEncryption();
      setMessage({ tone: 'ok', text: 'Đã tắt mã hóa.' });
      void syncNow();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  }

  return (
    <Card title="Mã hóa dữ liệu trên Drive">
      <dl className={styles.rows}>
        <dt>Máy này</dt>
        <dd>
          {enabled ? (
            <>
              <div className={styles.ok}>🔒 Đang bật</div>
              <p className={styles.hint}>
                File của máy này trên Drive được mã hóa (AES-GCM 256 bit). Dữ liệu trên máy
                (data.json, backup) vẫn ở dạng thường.
              </p>
            </>
          ) : (
            <>
              <div>Đang tắt</div>
              <p className={styles.hint}>
                File của máy này trên Drive ở dạng thường: ai mở được thư mục Drive đều đọc được.
                {keyB64 && ' Máy này vẫn giữ khóa để đọc file mã hóa của máy kia.'}
              </p>
            </>
          )}
        </dd>

        <dt>Máy kia</dt>
        <dd>
          <OtherMachine
            needsKey={needsKey}
            wrongKey={wrongKey}
            enabled={enabled}
            encrypted={remotes.map((r) => r.encrypted)}
          />
          <div className={styles.actions}>
            {(needsKey || wrongKey) && syncFolder && (
              <Button size="sm" variant="primary" onClick={() => setDialog('enter')}>
                Nhập mật khẩu chung...
              </Button>
            )}
            {manage && (
              <Button size="sm" onClick={() => setDialog('set')}>
                {enabled ? 'Đổi mật khẩu...' : 'Bật mã hóa...'}
              </Button>
            )}
            {manage && enabled && (
              <Button size="sm" variant="ghost" onClick={() => setDialog('disable')}>
                Tắt mã hóa
              </Button>
            )}
          </div>
          {!manage && !needsKey && !wrongKey && (
            <p className={styles.hint}>
              Chỉ admin bật, tắt và đổi mật khẩu mã hóa. Khi máy admin bật mã hóa, máy này sẽ được
              nhắc nhập mật khẩu chung.
            </p>
          )}
          {message && (
            <p className={message.tone === 'ok' ? styles.okMessage : styles.errorMessage}>
              {message.text}
            </p>
          )}
        </dd>
      </dl>

      {dialog === 'set' && (
        <PasswordDialog
          title={enabled ? 'Đổi mật khẩu mã hóa' : 'Bật mã hóa'}
          submitLabel={enabled ? 'Đổi mật khẩu' : 'Bật mã hóa'}
          confirm
          onSubmit={setPassword}
          onCancel={() => setDialog(null)}
        >
          <p className={styles.notice}>
            Hãy ghi lại mật khẩu: máy thứ hai cần nhập đúng mật khẩu này. Quên mật khẩu thì file
            trên Drive không đọc được nữa, nhưng dữ liệu trên máy vẫn còn và admin có thể đặt mật
            khẩu mới.
            {enabled && ' Sau khi đổi, máy kia phải nhập mật khẩu mới mới đọc được dữ liệu.'}
          </p>
        </PasswordDialog>
      )}

      {dialog === 'enter' && (
        <PasswordDialog
          title="Nhập mật khẩu chung"
          submitLabel="Lưu mật khẩu"
          onSubmit={(password) => enterPassword(password)}
          onCancel={() => setDialog(null)}
        >
          <p className={styles.hint}>
            Nhập mật khẩu mã hóa mà admin đã đặt. App kiểm tra bằng file của máy kia trên Drive và
            chỉ lưu khóa đã tạo từ mật khẩu, không lưu mật khẩu.
          </p>
        </PasswordDialog>
      )}

      {dialog === 'disable' && (
        <ConfirmDialog
          title="Tắt mã hóa?"
          confirmLabel="Tắt mã hóa"
          danger
          onCancel={() => setDialog(null)}
          onConfirm={() => void disable()}
        >
          File của máy này trên Drive sẽ được ghi lại ở dạng thường, ai mở được thư mục Drive đều
          đọc được. Máy này vẫn giữ khóa để đọc file mã hóa của máy kia.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function OtherMachine({
  needsKey,
  wrongKey,
  enabled,
  encrypted,
}: {
  needsKey: boolean;
  wrongKey: boolean;
  enabled: boolean;
  /** Mỗi file máy kia đọc được ở lượt sync gần nhất có mã hóa hay không. */
  encrypted: boolean[];
}) {
  if (needsKey) {
    return (
      <div className={styles.warning}>
        Máy kia đã bật mã hóa. Nhập mật khẩu chung mà admin đã đặt để đọc dữ liệu của máy kia.
      </div>
    );
  }
  if (wrongKey) {
    return (
      <div className={styles.warning}>
        Không giải mã được dữ liệu từ máy kia, kiểm tra mật khẩu. Nếu admin vừa đổi mật khẩu, hãy
        nhập mật khẩu mới.
      </div>
    );
  }
  if (encrypted.length === 0) {
    return <span className={styles.muted}>Chưa đọc được file của máy kia.</span>;
  }
  if (enabled && encrypted.includes(false)) {
    return (
      <div className={styles.warning}>
        File của máy kia trên Drive chưa mã hóa. Trên máy kia, vào Cài đặt → Mã hóa và nhập cùng mật
        khẩu.
      </div>
    );
  }
  return (
    <span className={styles.muted}>
      {encrypted.every(Boolean)
        ? 'File của máy kia trên Drive được mã hóa.'
        : 'File của máy kia trên Drive ở dạng thường.'}
    </span>
  );
}

function PasswordDialog({
  title,
  submitLabel,
  confirm = false,
  children,
  onSubmit,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  /** Ô nhập lại mật khẩu, khi đặt mật khẩu mới. */
  confirm?: boolean;
  children: ReactNode;
  onSubmit: (password: string, confirm: string) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password, again);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={() => !busy && onCancel()}
      width={420}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" form="password-form" variant="primary" disabled={busy || !password}>
            {busy ? 'Đang tạo khóa...' : submitLabel}
          </Button>
        </>
      }
    >
      <form id="password-form" className={styles.dialogForm} onSubmit={submit}>
        {children}
        <div className={styles.field}>
          <label htmlFor={`${id}-password`}>Mật khẩu</label>
          <input
            id={`${id}-password`}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            autoFocus
            autoComplete="new-password"
            disabled={busy}
            aria-describedby={confirm ? `${id}-hint` : undefined}
          />
          {confirm && (
            <span id={`${id}-hint`} className={styles.hint}>
              Ít nhất {MIN_PASSWORD_LENGTH} ký tự.
            </span>
          )}
        </div>
        {confirm && (
          <div className={styles.field}>
            <label htmlFor={`${id}-again`}>Nhập lại mật khẩu</label>
            <input
              id={`${id}-again`}
              type="password"
              value={again}
              onChange={(e) => {
                setAgain(e.target.value);
                setError(null);
              }}
              autoComplete="new-password"
              disabled={busy}
            />
          </div>
        )}
        {error && (
          <p className={styles.errorMessage} role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
