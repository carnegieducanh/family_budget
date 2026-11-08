import { useState, type FormEvent } from 'react';
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
import type { ScriptConnection } from '../storage/scriptAdapter';
import { ConnectionFields } from './ConnectionFields';
import { InstallHint } from './InstallHint';
import { parseConnection, readFamilyFiles } from './scriptConnect';
import styles from '../features/setup/SetupScreen.module.scss';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface Candidate {
  connection: ScriptConnection;
  data: DataFile;
}

/**
 * Thiết lập lần đầu của bản web: dán link và mã kết nối của Google Apps Script mà admin đã cài
 * (apps-script/Code.gs), app đọc dữ liệu gia đình trên Drive qua script, rồi chọn tài khoản như
 * máy thứ hai của app desktop. Bản web không tạo dữ liệu gia đình mới.
 */
export function WebSetupScreen() {
  const local = useDataStore((s) => s.data);
  const hasLocalData = local !== null && active(local.users).length > 0;
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [problems, setProblems] = useState<RemoteProblem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [chosen, setChosen] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [scrollRef] = useSmoothScroll();

  // Đã có dữ liệu trên trình duyệt này nhưng chưa biết là của ai: chỉ chọn tài khoản.
  const family = hasLocalData ? local : candidate?.data;

  async function connect(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setProblems([]);
    setChecking(true);
    try {
      const connection = parseConnection(url, secret);
      const deviceId = useDataStore.getState().settings?.deviceId;
      if (!deviceId) throw new Error('Chưa đọc được settings.');
      const files = await readFamilyFiles(connection, deviceId);
      const result = dataForJoin(deviceId, files, new Date());
      setProblems(result.problems);
      if (result.kind === 'error') setError(result.message);
      else setCandidate({ connection, data: result.data });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  async function finish(user: User, avatar: string) {
    setSaving(true);
    try {
      const store = useDataStore.getState();
      if (hasLocalData) {
        await store.chooseUser(user.id, avatar);
      } else if (candidate) {
        const { connection, data } = candidate;
        await store.joinHousehold(data, user.id, avatar, connection.url, null, connection.key);
      }
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
  if (chosen && family) {
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
  } else if (family) {
    body = (
      <div className={styles.form}>
        <p className={styles.lead}>Chọn tài khoản của bạn để bắt đầu.</p>
        <ProfileChoice users={householdUsers(family)} disabled={saving} onChoose={setChosen} />
        {error && <p className={styles.error}>{error}</p>}
        {problemList}
        {!hasLocalData && (
          <div className={styles.buttons}>
            <Button onClick={() => setCandidate(null)} disabled={saving}>
              Quay lại
            </Button>
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <form className={styles.form} onSubmit={(e) => void connect(e)}>
        <InstallHint beforeSetup />
        <p className={styles.lead}>
          Kết nối với dữ liệu của gia đình trên Google Drive. Người tạo dữ liệu (admin) cài script
          kết nối theo hướng dẫn, rồi gửi bạn link và mã kết nối.
        </p>
        <ConnectionFields
          url={url}
          secret={secret}
          disabled={checking}
          onUrl={setUrl}
          onSecret={setSecret}
        />
        {error && <p className={styles.error}>{error}</p>}
        {problemList}
        <Button
          type="submit"
          variant="primary"
          disabled={checking || !url.trim() || !secret.trim()}
          className={styles.pick}
        >
          {checking ? 'Đang đọc dữ liệu...' : 'Kết nối'}
        </Button>
      </form>
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
