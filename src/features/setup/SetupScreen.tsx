import { useId, useState, type FormEvent } from 'react';
import { householdUsers } from '../../core/household';
import { active } from '../../core/records';
import { dataForJoin, type RemoteProblem } from '../../core/sync';
import type { DataFile } from '../../core/types';
import { Button } from '../../components/Button';
import { UpdateBanner } from '../../components/UpdateBanner';
import { UserName } from '../../components/UserDot';
import { useDataStore } from '../../state/dataStore';
import {
  exportFileKey,
  fileKeyFromPassword,
  type FileKey,
  type StoredKey,
} from '../../storage/crypto';
import { pickSyncFolder } from '../../storage/driveFolderAdapter';
import { encryptedContents, inspectFolder, type FolderContents } from '../../sync/appSync';
import { openRemoteFiles } from '../../sync/syncService';
import styles from './SetupScreen.module.scss';

type Mode = 'choose' | 'create' | 'join';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Thiết lập lần đầu (SPEC mục 5, 8): máy admin tạo dữ liệu mới, máy thứ hai tham gia bằng
 * cách chọn cùng thư mục Drive. Nếu máy đã có data.json nhưng chưa biết là của ai thì chỉ
 * cho chọn "Tôi là ...", không tạo dữ liệu mới đè lên.
 */
export function SetupScreen() {
  const data = useDataStore((s) => s.data);
  const [mode, setMode] = useState<Mode>('choose');
  const hasLocalData = data !== null && active(data.users).length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <UpdateBanner />
        <h1 className={styles.title}>Chào mừng đến Family Budget</h1>
        {hasLocalData ? (
          <ChooseUser />
        ) : mode === 'create' ? (
          <CreateHousehold onBack={() => setMode('choose')} />
        ) : mode === 'join' ? (
          <JoinHousehold onBack={() => setMode('choose')} />
        ) : (
          <ChooseMode onChoose={setMode} />
        )}
      </div>
    </div>
  );
}

function ChooseMode({ onChoose }: { onChoose: (mode: Mode) => void }) {
  return (
    <div className={styles.form}>
      <p className={styles.lead}>Máy này dùng để làm gì?</p>
      <button type="button" className={styles.option} onClick={() => onChoose('create')}>
        <strong>Tạo dữ liệu mới (admin)</strong>
        <span>
          Máy đầu tiên. Nhập tên 2 người và chọn thư mục Google Drive để đồng bộ với máy thứ hai.
        </span>
      </button>
      <button type="button" className={styles.option} onClick={() => onChoose('join')}>
        <strong>Tham gia (máy thứ hai)</strong>
        <span>Máy admin đã tạo dữ liệu. Chọn đúng thư mục Google Drive mà máy admin đã chọn.</span>
      </button>
    </div>
  );
}

/** Nút chọn thư mục Drive và đường dẫn đã chọn. */
function FolderField({
  folder,
  checking,
  onPick,
}: {
  folder: FolderContents | null;
  checking: boolean;
  onPick: () => void;
}) {
  return (
    <div className={styles.field}>
      <span>Thư mục Google Drive</span>
      {folder && <code className={styles.path}>{folder.folder}</code>}
      <Button onClick={onPick} disabled={checking} className={styles.pick}>
        {checking ? 'Đang kiểm tra...' : folder ? 'Chọn thư mục khác...' : 'Chọn thư mục...'}
      </Button>
      {folder && (
        <span className={styles.hint}>
          Dữ liệu đồng bộ nằm trong <code className={styles.path}>{folder.dataDir}</code>
        </span>
      )}
    </div>
  );
}

/** Hộp chọn thư mục rồi đọc nội dung; null nếu người dùng bấm hủy. */
async function pickAndInspect(current: string | null): Promise<FolderContents | null> {
  const folder = await pickSyncFolder(current);
  if (!folder) return null;
  const deviceId = useDataStore.getState().settings?.deviceId;
  if (!deviceId) throw new Error('Chưa đọc được settings.');
  return inspectFolder(folder, deviceId);
}

const FOLDER_HAS_DATA =
  'Thư mục này đã có dữ liệu Family Budget. Hãy quay lại và chọn “Tham gia (máy thứ hai)”, hoặc chọn một thư mục khác.';

function CreateHousehold({ onBack }: { onBack: () => void }) {
  const [myName, setMyName] = useState('');
  const [otherName, setOtherName] = useState('');
  const [folder, setFolder] = useState<FolderContents | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick() {
    setError(null);
    setChecking(true);
    try {
      const contents = await pickAndInspect(folder?.folder ?? null);
      if (!contents) return;
      if (contents.deviceFiles.length > 0) {
        setFolder(null);
        setError(FOLDER_HAS_DATA);
        return;
      }
      setFolder(contents);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!folder) {
      setError('Hãy chọn thư mục Google Drive.');
      return;
    }
    setSaving(true);
    try {
      // Kiểm tra lại ngay trước khi tạo: không bao giờ tạo bộ dữ liệu thứ hai trong cùng thư mục.
      const deviceId = useDataStore.getState().settings?.deviceId ?? '';
      const latest = await inspectFolder(folder.folder, deviceId);
      if (latest.deviceFiles.length > 0) throw new Error(FOLDER_HAS_DATA);
      await useDataStore.getState().createHousehold(myName, otherName, folder.folder);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <p className={styles.lead}>
        Tạo dữ liệu mới cho gia đình. Người tạo là <strong>admin</strong>, quản lý danh mục, ngân
        sách và cài đặt.
      </p>
      <label className={styles.field}>
        <span>Tên của bạn (admin)</span>
        <input
          value={myName}
          onChange={(e) => setMyName(e.target.value)}
          autoFocus
          maxLength={40}
          placeholder="Ví dụ: Huy"
        />
      </label>
      <label className={styles.field}>
        <span>Tên người còn lại</span>
        <input
          value={otherName}
          onChange={(e) => setOtherName(e.target.value)}
          maxLength={40}
          placeholder="Ví dụ: Lan"
        />
      </label>
      <FolderField folder={folder} checking={checking} onPick={() => void pick()} />
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.buttons}>
        <Button onClick={onBack} disabled={saving}>
          Quay lại
        </Button>
        <Button type="submit" variant="primary" disabled={saving || checking || !folder}>
          {saving ? 'Đang tạo...' : 'Tạo dữ liệu'}
        </Button>
      </div>
    </form>
  );
}

interface JoinCandidate {
  folder: FolderContents;
  data: DataFile;
  /** Khóa dẫn xuất từ mật khẩu chung, nếu dữ liệu trong thư mục đã được mã hóa. */
  key: StoredKey | null;
}

function JoinHousehold({ onBack }: { onBack: () => void }) {
  const id = useId();
  const [folder, setFolder] = useState<FolderContents | null>(null);
  const [candidate, setCandidate] = useState<JoinCandidate | null>(null);
  const [problems, setProblems] = useState<RemoteProblem[]>([]);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Đọc dữ liệu gia đình từ các file trong thư mục (giải mã bằng `fileKey` nếu có). */
  async function evaluate(contents: FolderContents, fileKey: FileKey | null) {
    const deviceId = useDataStore.getState().settings?.deviceId ?? '';
    const files = await openRemoteFiles(contents.rawFiles, fileKey);
    const result = dataForJoin(deviceId, files, new Date());
    // File mã hóa chưa mở được đã có ô nhập mật khẩu, không cần liệt kê là file lỗi.
    setProblems(result.problems.filter((p) => p.reason !== 'encrypted'));
    if (result.kind === 'error') {
      setCandidate(null);
      setError(result.message);
      return;
    }
    const key = fileKey ? await exportFileKey(fileKey) : null;
    setCandidate({ folder: contents, data: result.data, key });
    setError(null);
  }

  async function pick() {
    setError(null);
    setChecking(true);
    try {
      const contents = await pickAndInspect(folder?.folder ?? null);
      if (!contents) return;
      setFolder(contents);
      setCandidate(null);
      setPassword('');
      // Gia đình đã bật mã hóa: máy mới phải có mật khẩu chung mới tham gia được, để
      // file của máy này trên Drive cũng được mã hóa.
      const encrypted = encryptedContents(contents.rawFiles).length > 0;
      setNeedsPassword(encrypted);
      if (encrypted) {
        setProblems([]);
        return;
      }
      await evaluate(contents, null);
    } catch (e) {
      setCandidate(null);
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (!folder) return;
    setError(null);
    setChecking(true);
    try {
      const fileKey = await fileKeyFromPassword(password, encryptedContents(folder.rawFiles));
      await evaluate(folder, fileKey);
      setNeedsPassword(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  async function choose(userId: string) {
    if (!candidate) return;
    setSaving(true);
    try {
      await useDataStore
        .getState()
        .joinHousehold(candidate.data, userId, candidate.folder.folder, candidate.key);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <div className={styles.form}>
      <p className={styles.lead}>
        Chọn thư mục Google Drive mà máy admin đã chọn khi tạo dữ liệu. Nếu dùng 2 tài khoản Google,
        đó là thư mục admin đã chia sẻ và bạn đã “Thêm lối tắt vào Drive”.
      </p>
      <FolderField folder={folder} checking={checking} onPick={() => void pick()} />
      {needsPassword && (
        <form onSubmit={unlock} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor={`${id}-password`}>Mật khẩu mã hóa</label>
            <input
              id={`${id}-password`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="off"
              aria-describedby={`${id}-hint`}
            />
            <span id={`${id}-hint`} className={styles.hint}>
              Dữ liệu trong thư mục này đã được mã hóa. Nhập mật khẩu chung mà admin đã đặt.
            </span>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={checking || !password}
            className={styles.pick}
          >
            {checking ? 'Đang kiểm tra...' : 'Mở khóa dữ liệu'}
          </Button>
        </form>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {problems.length > 0 && (
        <ul className={styles.problems}>
          {problems.map((p) => (
            <li key={p.name}>
              Bỏ qua <code>{p.name}</code>: {p.message}
            </li>
          ))}
        </ul>
      )}
      {candidate && (
        <>
          <p className={styles.found}>
            Tìm thấy dữ liệu của gia đình ({active(candidate.data.transactions).length} khoản chi
            {candidate.key && ', đã giải mã'}).
          </p>
          <p className={styles.lead}>Bạn là ai?</p>
          {householdUsers(candidate.data).map((user) => (
            <Button
              key={user.id}
              onClick={() => void choose(user.id)}
              disabled={saving}
              className={styles.choice}
            >
              Tôi là&nbsp;
              <UserName user={user} />
            </Button>
          ))}
        </>
      )}
      <div className={styles.buttons}>
        <Button onClick={onBack} disabled={saving}>
          Quay lại
        </Button>
      </div>
    </div>
  );
}

function ChooseUser() {
  const data = useDataStore((s) => s.data);
  const [error, setError] = useState<string | null>(null);
  const users = data ? active(data.users) : [];

  async function choose(userId: string) {
    try {
      await useDataStore.getState().chooseUser(userId);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className={styles.form}>
      <p className={styles.lead}>Máy này đã có dữ liệu. Bạn là ai?</p>
      {users.map((user) => (
        <Button key={user.id} onClick={() => choose(user.id)} className={styles.choice}>
          Tôi là&nbsp;
          <UserName user={user} />
        </Button>
      ))}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
