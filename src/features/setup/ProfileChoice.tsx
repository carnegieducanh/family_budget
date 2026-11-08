import { useState } from 'react';
import { AvatarPicker } from '../../components/AvatarPicker';
import { Button } from '../../components/Button';
import { UserAvatar } from '../../components/UserDot';
import type { User } from '../../core/types';
import styles from './SetupScreen.module.scss';

// Chọn tài khoản lúc thiết lập lần đầu, dùng chung cho app desktop và bản web.

/** Người dùng của gia đình dạng thẻ có ảnh đại diện; bấm thẻ để chọn mình là người đó. */
export function ProfileChoice({
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
export function AvatarStep({
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
