import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { can, canEditAvatar } from '../../core/permissions';
import type { User } from '../../core/types';
import { AvatarPicker } from '../../components/AvatarPicker';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { UserAvatar, UserDot } from '../../components/UserDot';
import { useDataStore, useReadyData } from '../../state/dataStore';
import styles from './SettingsScreen.module.scss';

/**
 * Người dùng và vai trò (admin sửa được; luôn có đúng một admin — SPEC mục 7). Ảnh đại diện
 * thì mỗi người tự đổi được của mình.
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
            {canEditAvatar(me, user) ? (
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
            {editable ? (
              <UserFields user={user} onSave={run} />
            ) : (
              <span className={styles.userName}>
                <UserDot user={user} />
                {user.name}
              </span>
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
          : 'Chỉ admin đổi được tên, màu và vai trò. Ảnh đại diện của mình thì bạn tự đổi được: bấm vào ảnh.'}
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

/** Màu và tên, lưu khi rời ô hoặc bấm Enter. */
function UserFields({ user, onSave }: { user: User; onSave: (action: () => void) => boolean }) {
  const [name, setName] = useState(user.name);
  const [savedAt, setSavedAt] = useState(user.updatedAt);

  if (savedAt !== user.updatedAt) {
    setSavedAt(user.updatedAt);
    setName(user.name);
  }

  function save(changes: { name?: string; color?: string }) {
    const input = { name: changes.name ?? user.name, color: changes.color ?? user.color };
    if (input.name === user.name && input.color.toUpperCase() === user.color.toUpperCase()) return;
    if (!onSave(() => useDataStore.getState().updateUser(user.id, input))) setName(user.name);
  }

  // Lưu màu khi đóng bảng chọn màu (sự kiện change gốc), không lưu liên tục lúc đang kéo.
  const colorRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = colorRef.current;
    if (!input) return;
    const onChange = () => save({ color: input.value });
    input.addEventListener('change', onChange);
    return () => input.removeEventListener('change', onChange);
  });

  return (
    <span className={styles.userName}>
      <input
        key={user.color}
        ref={colorRef}
        type="color"
        className={styles.color}
        defaultValue={user.color.toLowerCase()}
        aria-label={`Màu của ${user.name}`}
      />
      <input
        value={name}
        maxLength={40}
        aria-label={`Tên của ${user.name}`}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => save({ name })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setName(user.name);
        }}
      />
    </span>
  );
}
