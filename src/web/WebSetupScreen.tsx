import { useRef, useState } from 'react';
import { BrandMark } from '../components/BrandMark';
import { Button } from '../components/Button';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { useSmoothScroll } from '../components/useSmoothScroll';
import { householdUsers } from '../core/household';
import { active } from '../core/records';
import { dataForJoin, type RemoteProblem } from '../core/sync';
import type { DataFile, User } from '../core/types';
import { AvatarStep, ProfileChoice } from '../features/setup/ProfileChoice';
import { useDataStore } from '../state/dataStore';
import styles from '../features/setup/SetupScreen.module.scss';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Thiết lập lần đầu của bản web. Chưa nối được Google Drive từ trình duyệt, nên tạm mở dữ liệu
 * gia đình từ file của app trên máy tính (device-*.json trên Drive, hoặc data.json), rồi chọn
 * tài khoản như máy thứ hai của app desktop. Bản web không tạo dữ liệu gia đình mới.
 */
export function WebSetupScreen() {
  const local = useDataStore((s) => s.data);
  const hasLocalData = local !== null && active(local.users).length > 0;
  const [opened, setOpened] = useState<DataFile | null>(null);
  const [problems, setProblems] = useState<RemoteProblem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [chosen, setChosen] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scrollRef] = useSmoothScroll();

  // Đã có dữ liệu trên trình duyệt này nhưng chưa biết là của ai: chỉ chọn tài khoản.
  const candidate = hasLocalData ? local : opened;

  async function open(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setReading(true);
    try {
      const deviceId = useDataStore.getState().settings?.deviceId;
      if (!deviceId) throw new Error('Chưa đọc được settings.');
      const remote = await Promise.all(
        [...files].map(async (file) => ({ name: file.name, content: await file.text() })),
      );
      const result = dataForJoin(deviceId, remote, new Date());
      setProblems(result.problems);
      if (result.kind === 'error') {
        setOpened(null);
        setError(result.message);
      } else {
        setOpened(result.data);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = ''; // chọn lại cùng file vẫn đọc lại
    }
  }

  async function finish(user: User, avatar: string) {
    if (!candidate) return;
    setSaving(true);
    try {
      const store = useDataStore.getState();
      if (hasLocalData) await store.chooseUser(user.id, avatar);
      else await store.joinHousehold(candidate, user.id, avatar, null, null);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
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

  let body;
  if (chosen && candidate) {
    body = (
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
  } else if (candidate) {
    body = (
      <div className={styles.form}>
        <p className={styles.lead}>Chọn tài khoản của bạn để bắt đầu.</p>
        <ProfileChoice users={householdUsers(candidate)} disabled={saving} onChoose={setChosen} />
        {error && <p className={styles.error}>{error}</p>}
        {problemList}
        {!hasLocalData && (
          <div className={styles.buttons}>
            <Button onClick={() => setOpened(null)} disabled={saving}>
              Quay lại
            </Button>
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <div className={styles.form}>
        <p className={styles.lead}>
          Bản web chưa kết nối được Google Drive. Để dùng thử, hãy mở file dữ liệu của app trên máy
          tính:
        </p>
        <div className={styles.steps}>
          <ul>
            <li>
              file <code>device-….json</code> trong thư mục FamilyBudget trên Google Drive (chọn
              được nhiều file cùng lúc), hoặc
            </li>
            <li>
              file <code>data.json</code> trong thư mục dữ liệu của app.
            </li>
          </ul>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          onChange={(e) => void open(e.target.files)}
        />
        <Button
          variant="primary"
          disabled={reading}
          className={styles.pick}
          onClick={() => inputRef.current?.click()}
        >
          {reading ? 'Đang đọc...' : 'Mở file dữ liệu...'}
        </Button>
        {error && <p className={styles.error}>{error}</p>}
        {problemList}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={styles.page}>
      <div className={styles.theme}>
        <ThemeSwitcher compact />
      </div>
      <div className={styles.panel}>
        <div className={styles.logo}>
          <BrandMark size={80} />
        </div>
        <h1 className={styles.title}>Chào mừng đến Family Budget</h1>
        {body}
      </div>
    </div>
  );
}
