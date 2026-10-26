import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { can, canEditProfile } from '../../core/permissions';
import type { User } from '../../core/types';
import { AvatarPicker } from '../../components/AvatarPicker';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { UserAvatar } from '../../components/UserDot';
import { useDataStore, useReadyData } from '../../state/dataStore';
import styles from './SettingsScreen.module.scss';

/**
 * Người dùng và vai trò (admin chuyển được vai trò; luôn có đúng một admin — SPEC mục 7). Tên
 * và ảnh đại diện thì mỗi người tự đổi được của mình, admin đổi được của cả hai.
 */
export function UsersSettings() {
  const { me, users } = useReadyData();
  const editable = can(me, 'users:manage');
  const [error, setError] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState<User | null>(null);
  const [avatarOf, setAvatarOf] = useState<User | null>(null);

  function run(action: () => void): boolean {
    try {
      action();
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  return (
    <Card title="Người dùng và vai trò">
      <ul className={styles.users}>
        {users.map((user) => (
          <li key={user.id}>
            {canEditProfile(me, user) ? (
              <button
                type="button"
                className={styles.avatarButton}
                onClick={() => setAvatarOf(user)}
                aria-label={`Đổi ảnh đại diện của ${user.name}`}
                title="Đổi ảnh đại diện"
              >
                <UserAvatar user={user} size={40} />
                <span className={styles.avatarBadge} aria-hidden="true">
                  <Pencil size={10} strokeWidth={2.4} />
                </span>
              </button>
            ) : (
              <UserAvatar user={user} size={40} />
            )}
            {canEditProfile(me, user) ? (
              <UserNameField user={user} onSave={run} />
            ) : (
              <span className={styles.userName}>{user.name}</span>
            )}
            <span className={styles.role}>
              {user.role === 'admin' ? 'Admin' : 'Thành viên'}
              {user.id === me.id && ' (bạn)'}
            </span>
            {editable && user.role !== 'admin' && (
              <Button size="sm" onClick={() => setTransferTo(user)}>
                Chuyển quyền admin cho {user.name}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className={styles.errorMessage}>{error}</p>}
      <p className={styles.hint}>
        {editable
          ? 'Admin quản lý danh mục, ngân sách, chi tiêu định kỳ, import CSV, khôi phục backup và sửa được mọi khoản chi. Thành viên chỉ sửa, xóa được khoản do mình nhập.'
          : 'Chỉ admin chuyển được vai trò. Tên và ảnh đại diện của mình thì bạn tự đổi được: sửa ô tên, hoặc bấm vào ảnh.'}
      </p>

      {avatarOf && <AvatarDialog user={avatarOf} onClose={() => setAvatarOf(null)} />}

      {transferTo && (
        <ConfirmDialog
          title={`Chuyển quyền admin cho ${transferTo.name}?`}
          confirmLabel="Chuyển quyền"
          onCancel={() => setTransferTo(null)}
          onConfirm={() => {
            run(() => useDataStore.getState().transferAdmin(transferTo.id));
            setTransferTo(null);
          }}
        >
          Sau khi chuyển, bạn trở thành thành viên: không quản lý được danh mục, ngân sách, chi tiêu
          định kỳ và chỉ sửa được khoản do mình nhập. {transferTo.name} có thể chuyển quyền lại cho
          bạn.
        </ConfirmDialog>
      )}
    </Card>
  );
}

/** Chọn ảnh đại diện, chỉ lưu khi bấm Lưu. */
function AvatarDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [avatar, setAvatar] = useState(user.avatar);
  const [error, setError] = useState<string | null>(null);

  function save() {
    try {
      useDataStore.getState().setAvatar(user.id, avatar ?? null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal
      title={`Ảnh đại diện của ${user.name}`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={save} disabled={avatar === user.avatar}>
            Lưu
          </Button>
        </>
      }
    >
      <AvatarPicker
        user={{ ...user, avatar }}
        onChange={(next) => setAvatar(next ?? undefined)}
        allowClear
      />
      {error && <p className={styles.errorMessage}>{error}</p>}
    </Modal>
  );
}

/** Ô tên, lưu khi rời ô hoặc bấm Enter. */
function UserNameField({ user, onSave }: { user: User; onSave: (action: () => void) => boolean }) {
  const [name, setName] = useState(user.name);
  const [savedAt, setSavedAt] = useState(user.updatedAt);

  if (savedAt !== user.updatedAt) {
    setSavedAt(user.updatedAt);
    setName(user.name);
  }

  function save() {
    if (name === user.name) return;
    if (!onSave(() => useDataStore.getState().updateUser(user.id, { name }))) setName(user.name);
  }

  return (
    <span className={styles.userName}>
      <input
        value={name}
        maxLength={40}
        aria-label={`Tên của ${user.name}`}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setName(user.name);
        }}
      />
    </span>
  );
}
