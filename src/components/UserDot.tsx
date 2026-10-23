import type { User } from '../core/types';
import styles from './UserDot.module.scss';

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

/** Chấm màu kèm tên người. */
export function UserName({ user }: { user: User | undefined }) {
  return (
    <span className={styles.name}>
      <UserDot user={user} />
      {user?.name ?? '—'}
    </span>
  );
}
