import { viewAvatar } from '../core/avatar';
import type { User } from '../core/types';
import styles from './UserDot.module.scss';

/** Những gì cần để vẽ avatar; màn thiết lập dùng cả khi người dùng chưa được tạo. */
export type AvatarUser = Pick<User, 'name' | 'color' | 'avatar'>;

/** Chấm màu của một người. Luôn đặt cạnh tên, hoặc có tooltip tên, để màu không đứng một mình. */
export function UserDot({ user, title }: { user: User | undefined; title?: string }) {
  return (
    <span
      className={styles.dot}
      style={{ background: user?.color ?? 'var(--color-text-muted)' }}
      title={title ?? user?.name}
      aria-hidden={title === undefined}
    />
  );
}

/**
 * Ảnh đại diện tròn của người: ảnh, emoji trên nền nhạt màu của người đó, hoặc chữ cái đầu
 * của tên trên nền màu nếu chưa đặt. Đặt cạnh tên; đứng một mình thì dùng UserFace.
 */
export function UserAvatar({ user, size = 32 }: { user: AvatarUser | undefined; size?: number }) {
  const color = user?.color ?? 'var(--color-text-muted)';
  const view = viewAvatar(user?.avatar);
  const box = { width: size, height: size };

  if (view.kind === 'image') {
    return (
      <span className={`${styles.avatar} ${styles.photo}`} style={box} aria-hidden="true">
        <img src={view.src} alt="" draggable={false} />
      </span>
    );
  }
  if (view.kind === 'emoji') {
    return (
      <span
        className={`${styles.avatar} ${styles.emoji}`}
        style={{
          ...box,
          fontSize: Math.round(size * 0.56),
          background: `color-mix(in srgb, ${color} 22%, var(--color-surface))`,
        }}
        aria-hidden="true"
      >
        {view.emoji}
      </span>
    );
  }
  const initial = user?.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className={styles.avatar}
      style={{ ...box, fontSize: Math.round(size * 0.42), background: color }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

/**
 * Ảnh đại diện đứng thay tên người trong bảng và trong câu. Tên vẫn có ở tooltip và cho
 * trình đọc màn hình.
 */
export function UserFace({ user, size = 24 }: { user: User | undefined; size?: number }) {
  const name = user?.name ?? 'không rõ';
  return (
    <span className={styles.face} role="img" aria-label={name} title={name}>
      <UserAvatar user={user} size={size} />
    </span>
  );
}

/** Chấm màu kèm tên người. */
export function UserName({ user }: { user: User | undefined }) {
  return (
    <span className={styles.name}>
      <UserDot user={user} />
      {user?.name ?? '—'}
    </span>
  );
}
