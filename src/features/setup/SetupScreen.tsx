import { useEffect, useId, useState, type FormEvent } from 'react';
import { USER_COLORS } from '../../core/defaults';
import { householdUsers } from '../../core/household';
import { active } from '../../core/records';
import { dataForJoin, type RemoteProblem } from '../../core/sync';
import type { DataFile, User } from '../../core/types';
import { AvatarPicker } from '../../components/AvatarPicker';
import { BrandMark } from '../../components/BrandMark';
import { Button } from '../../components/Button';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { UpdateDialog } from '../../components/UpdateDialog';
import { UserAvatar } from '../../components/UserDot';
import { useDataStore } from '../../state/dataStore';
import {
  exportFileKey,
  fileKeyFromPassword,
  type FileKey,
  type StoredKey,
} from '../../storage/crypto';
import { findSyncFolders, pickSyncFolder } from '../../storage/driveFolderAdapter';
import { encryptedContents, inspectFolder, type FolderContents } from '../../sync/appSync';
import { openRemoteFiles } from '../../sync/syncService';
import styles from './SetupScreen.module.scss';

type Mode = 'searching' | 'notFound' | 'create' | 'join';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Thiết lập lần đầu (SPEC mục 5, 8): máy admin tạo dữ liệu mới, máy thứ hai tham gia bằng
 * cùng thư mục Drive. Máy mới cài tìm sẵn dữ liệu gia đình trong Google Drive trước; thấy
 * thì chỉ còn bước chọn tài khoản, không có đường tạo dữ liệu mới. Nếu máy đã có data.json
 * nhưng chưa biết là của ai thì chỉ cho chọn tài khoản, không tạo dữ liệu mới đè lên.
 */
export function SetupScreen() {
  const data = useDataStore((s) => s.data);
  const hasLocalData = data !== null && active(data.users).length > 0;
  const [mode, setMode] = useState<Mode>(hasLocalData ? 'notFound' : 'searching');
  const [found, setFound] = useState<FolderCheck | null>(null);
  const [searches, setSearches] = useState(0);

  useEffect(() => {
    if (mode !== 'searching') return;
    let cancelled = false;
    void findFamily().then((check) => {
      if (cancelled) return;
      setFound(check);
      setSearches((n) => n + 1);
      setMode(check ? 'join' : 'notFound');
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const search = () => setMode('searching');

  return (
    <div className={styles.page}>
      <div className={styles.theme}>
        <ThemeSwitcher compact />
      </div>
      <div className={styles.panel}>
        <UpdateDialog />
        <div className={styles.logo}>
          <BrandMark size={80} />
        </div>
        <h1 className={styles.title}>Chào mừng đến Family Budget</h1>
        {hasLocalData ? (
          <ChooseUser />
        ) : mode === 'searching' ? (
          <p className={styles.lead}>Đang tìm dữ liệu của gia đình trên Google Drive...</p>
        ) : mode === 'create' ? (
          <CreateHousehold onBack={search} />
        ) : mode === 'join' ? (
          <JoinHousehold found={found} onBack={found ? undefined : search} />
        ) : (
          <NotFound
            retried={searches > 1}
            onRetry={search}
            onPick={() => setMode('join')}
            onCreate={() => setMode('create')}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Dữ liệu gia đình tìm sẵn trong Google Drive của máy này; null nếu không thấy, thấy nhiều
 * hơn một thư mục (người dùng tự chọn), hoặc dữ liệu trong đó không dùng được.
 */
async function findFamily(): Promise<FolderCheck | null> {
  const deviceId = useDataStore.getState().settings?.deviceId;
  const folders = await findSyncFolders();
  const [only] = folders;
  if (folders.length !== 1 || !only || !deviceId) return null;
  try {
    const contents = await inspectFolder(only, deviceId);
    if (contents.deviceFiles.length === 0) return null;
    const check = await checkFolder(contents, null);
    return check.candidate || check.needsPassword ? check : null;
  } catch {
    return null;
  }
}

/**
 * Không thấy dữ liệu gia đình trên Google Drive của máy này. Thường là máy thứ hai chưa có
 * Google Drive for Desktop hoặc chưa có lối tắt tới thư mục được chia sẻ, nên hướng dẫn làm
 * cho có rồi tìm lại. Tạo dữ liệu mới chỉ là dòng phụ cho máy đầu tiên, để máy thứ hai không
 * bấm nhầm rồi tạo ra bộ dữ liệu thứ hai.
 */
function NotFound({
  retried,
  onRetry,
  onPick,
  onCreate,
}: {
  retried: boolean;
  onRetry: () => void;
  onPick: () => void;
  onCreate: () => void;
}) {
  return (
    <div className={styles.form}>
      <p className={styles.lead}>
        {retried
          ? 'Vẫn chưa tìm thấy dữ liệu gia đình trên Google Drive của máy này.'
          : 'Chưa tìm thấy dữ liệu gia đình trên Google Drive của máy này.'}
      </p>
      <div className={styles.steps}>
        <strong>Người nhà đã tạo dữ liệu trên máy khác?</strong>
        <ol>
          <li>Cài Google Drive for Desktop và đăng nhập.</li>
          <li>
            Nếu dùng tài khoản Google khác với người tạo: nhờ người tạo chia sẻ thư mục Family
            Budget cho bạn, mở link được gửi và bấm “Thêm lối tắt vào Drive”.
          </li>
          <li>Chờ Google Drive tải xong, rồi bấm Tìm lại.</li>
        </ol>
      </div>
      <div className={styles.buttons}>
        <Button onClick={onPick}>Tự chọn thư mục...</Button>
        <Button variant="primary" onClick={onRetry}>
          Tìm lại
        </Button>
      </div>
      <p className={styles.first}>
        Bạn là người đầu tiên dùng app trong gia đình?{' '}
        <button type="button" className={styles.textLink} onClick={onCreate}>
          Tạo dữ liệu mới
        </button>
      </p>
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
  'Thư mục này đã có dữ liệu Family Budget. Bấm Quay lại để tham gia bằng dữ liệu đó, hoặc chọn một thư mục khác.';

const familyExists = (dataDir: string) =>
  `Google Drive của máy này đã có dữ liệu gia đình trong ${dataDir}. Bấm Quay lại để chọn tài khoản của bạn thay vì tạo mới.`;

function CreateHousehold({ onBack }: { onBack: () => void }) {
  const [myName, setMyName] = useState('');
  const [myAvatar, setMyAvatar] = useState<string | undefined>();
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
    if (!myAvatar) {
      setError('Hãy chọn ảnh đại diện cho bạn.');
      return;
    }
    if (!folder) {
      setError('Hãy chọn thư mục Google Drive.');
      return;
    }
    setSaving(true);
    try {
      // Kiểm tra lại ngay trước khi tạo: không bao giờ tạo bộ dữ liệu thứ hai trong cùng thư mục,
      // cũng không tạo khi Google Drive của máy đã có dữ liệu gia đình ở thư mục khác.
      const deviceId = useDataStore.getState().settings?.deviceId ?? '';
      const latest = await inspectFolder(folder.folder, deviceId);
      if (latest.deviceFiles.length > 0) throw new Error(FOLDER_HAS_DATA);
      const [existing] = await findSyncFolders();
      if (existing) throw new Error(familyExists(existing));
      await useDataStore.getState().createHousehold(myName, otherName, myAvatar, folder.folder);
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
      <p className={styles.warning}>
        Chỉ làm bước này trên máy đầu tiên. Nếu người nhà đã tạo dữ liệu thì đừng tạo mới: hai bộ dữ
        liệu sẽ không đồng bộ với nhau. Bấm Quay lại và làm theo hướng dẫn để tham gia.
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
      <div className={styles.field}>
        <span>Ảnh đại diện của bạn</span>
        <AvatarPicker
          user={{ name: myName, color: USER_COLORS[0], avatar: myAvatar }}
          onChange={(next) => setMyAvatar(next ?? undefined)}
        />
        <span className={styles.hint}>
          Người còn lại tự chọn ảnh của mình khi tham gia trên máy thứ hai.
        </span>
      </div>
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

/** Kết quả đọc dữ liệu gia đình trong một thư mục Drive. */
interface FolderCheck {
  folder: FolderContents;
  /** Gia đình đã bật mã hóa: phải nhập mật khẩu chung trước. */
  needsPassword: boolean;
  candidate: JoinCandidate | null;
  problems: RemoteProblem[];
  error: string | null;
}

/**
 * Đọc dữ liệu gia đình từ các file trong thư mục (giải mã bằng `fileKey` nếu có). Gia đình
 * đã bật mã hóa thì máy mới phải có mật khẩu chung mới tham gia được, để file của máy này
 * trên Drive cũng được mã hóa.
 */
async function checkFolder(folder: FolderContents, fileKey: FileKey | null): Promise<FolderCheck> {
  if (!fileKey && encryptedContents(folder.rawFiles).length > 0) {
    return { folder, needsPassword: true, candidate: null, problems: [], error: null };
  }
  const deviceId = useDataStore.getState().settings?.deviceId ?? '';
  const files = await openRemoteFiles(folder.rawFiles, fileKey);
  const result = dataForJoin(deviceId, files, new Date());
  // File mã hóa chưa mở được đã có ô nhập mật khẩu, không cần liệt kê là file lỗi.
  const problems = result.problems.filter((p) => p.reason !== 'encrypted');
  if (result.kind === 'error') {
    return { folder, needsPassword: false, candidate: null, problems, error: result.message };
  }
  const key = fileKey ? await exportFileKey(fileKey) : null;
  const candidate = { folder, data: result.data, key };
  return { folder, needsPassword: false, candidate, problems, error: null };
}

/**
 * `found`: dữ liệu tìm sẵn trong Google Drive, khỏi phải chọn thư mục. Khi đó không truyền
 * `onBack`: gia đình đã có dữ liệu thì không quay về được bước tạo dữ liệu mới.
 */
function JoinHousehold({ found, onBack }: { found: FolderCheck | null; onBack?: () => void }) {
  const id = useId();
  const [folder, setFolder] = useState<FolderContents | null>(found?.folder ?? null);
  const [candidate, setCandidate] = useState<JoinCandidate | null>(found?.candidate ?? null);
  const [problems, setProblems] = useState<RemoteProblem[]>(found?.problems ?? []);
  const [needsPassword, setNeedsPassword] = useState(found?.needsPassword ?? false);
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(found?.error ?? null);
  const [saving, setSaving] = useState(false);
  const [chosen, setChosen] = useState<User | null>(null);

  function show(check: FolderCheck) {
    setFolder(check.folder);
    setCandidate(check.candidate);
    setProblems(check.problems);
    setNeedsPassword(check.needsPassword);
    setError(check.error);
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
      show(await checkFolder(contents, null));
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
      show(await checkFolder(folder, fileKey));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  async function finish(user: User, avatar: string) {
    if (!candidate) return;
    setSaving(true);
    try {
      await useDataStore
        .getState()
        .joinHousehold(candidate.data, user.id, avatar, candidate.folder.folder, candidate.key);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  if (chosen && candidate) {
    return (
      <AvatarStep
        user={chosen}
        saving={saving}
        error={error}
        onBack={() => {
          setChosen(null);
          setError(null);
        }}
        onDone={(avatar) => void finish(chosen, avatar)}
      />
    );
  }

  const problemList = problems.length > 0 && (
    <ul className={styles.problems}>
      {problems.map((p) => (
        <li key={p.name}>
          Bỏ qua <code>{p.name}</code>: {p.message}
        </li>
      ))}
    </ul>
  );

  if (candidate) {
    return (
      <div className={styles.form}>
        <p className={styles.lead}>Chọn tài khoản của bạn để bắt đầu.</p>
        <ProfileChoice
          users={householdUsers(candidate.data)}
          disabled={saving}
          onChoose={setChosen}
        />
        {error && <p className={styles.error}>{error}</p>}
        {problemList}
        {onBack && (
          <div className={styles.buttons}>
            <Button onClick={onBack} disabled={saving}>
              Quay lại
            </Button>
          </div>
        )}
      </div>
    );
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
      {problemList}
      {onBack && (
        <div className={styles.buttons}>
          <Button onClick={onBack} disabled={saving}>
            Quay lại
          </Button>
        </div>
      )}
    </div>
  );
}

function ChooseUser() {
  const data = useDataStore((s) => s.data);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [chosen, setChosen] = useState<User | null>(null);
  const users = data ? active(data.users) : [];

  async function finish(user: User, avatar: string) {
    setSaving(true);
    try {
      await useDataStore.getState().chooseUser(user.id, avatar);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  if (chosen) {
    return (
      <AvatarStep
        user={chosen}
        saving={saving}
        error={error}
        onBack={() => {
          setChosen(null);
          setError(null);
        }}
        onDone={(avatar) => void finish(chosen, avatar)}
      />
    );
  }

  return (
    <div className={styles.form}>
      <p className={styles.lead}>Máy này đã có dữ liệu. Chọn tài khoản của bạn để bắt đầu.</p>
      <ProfileChoice users={users} onChoose={setChosen} />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

/** Người dùng của gia đình dạng thẻ có ảnh đại diện; bấm thẻ để chọn mình là người đó. */
function ProfileChoice({
  users,
  disabled = false,
  onChoose,
}: {
  users: User[];
  disabled?: boolean;
  onChoose: (user: User) => void;
}) {
  return (
    <div className={styles.profiles}>
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          className={styles.profile}
          disabled={disabled}
          onClick={() => onChoose(user)}
        >
          <UserAvatar user={user} size={72} />
          <strong className={styles.profileName}>{user.name}</strong>
          <span className={styles.profileRole}>
            {user.role === 'admin' ? 'Admin' : 'Thành viên'}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Bước cuối khi tham gia hoặc chọn "Tôi là ...": người dùng máy này chọn ảnh đại diện của
 * mình (bắt buộc). Đã có ảnh (đặt từ trước) thì chọn sẵn, chỉ cần bấm Hoàn tất.
 */
function AvatarStep({
  user,
  saving,
  error,
  onBack,
  onDone,
}: {
  user: User;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onDone: (avatar: string) => void;
}) {
  const [avatar, setAvatar] = useState(user.avatar);

  return (
    <div className={styles.form}>
      <p className={styles.lead}>
        Chào <strong>{user.name}</strong>! Chọn ảnh đại diện của bạn.
      </p>
      <AvatarPicker user={{ ...user, avatar }} onChange={(next) => setAvatar(next ?? undefined)} />
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.buttons}>
        <Button onClick={onBack} disabled={saving}>
          Quay lại
        </Button>
        <Button
          variant="primary"
          disabled={saving || !avatar}
          onClick={() => avatar && onDone(avatar)}
        >
          {saving ? 'Đang lưu...' : 'Hoàn tất'}
        </Button>
      </div>
    </div>
  );
}
