import { useState, type FormEvent } from 'react';
import { active } from '../../core/records';
import { Button } from '../../components/Button';
import { UserName } from '../../components/UserDot';
import { useDataStore } from '../../state/dataStore';
import styles from './SetupScreen.module.scss';

/**
 * Thiết lập lần đầu, dạng rút gọn của giai đoạn 1: tạo 2 người và chọn mình là ai,
 * chưa cần thư mục Drive. Nếu máy đã có data.json nhưng chưa biết là của ai thì chỉ
 * cho chọn "Tôi là ...", không tạo dữ liệu mới đè lên.
 */
export function SetupScreen() {
  const data = useDataStore((s) => s.data);
  const existingUsers = data ? active(data.users) : [];

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <h1 className={styles.title}>Chào mừng đến Family Budget</h1>
        {existingUsers.length > 0 ? <ChooseUser /> : <CreateHousehold />}
      </div>
    </div>
  );
}

function CreateHousehold() {
  const [myName, setMyName] = useState('');
  const [otherName, setOtherName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await useDataStore.getState().createHousehold(myName, otherName);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" variant="primary" disabled={saving}>
        {saving ? 'Đang tạo...' : 'Tạo dữ liệu'}
      </Button>
      <p className={styles.hint}>
        Thư mục Google Drive để đồng bộ với máy thứ hai sẽ được thiết lập sau.
      </p>
    </form>
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
      setError(e instanceof Error ? e.message : String(e));
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
