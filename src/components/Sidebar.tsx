import { useReadyData } from '../state/dataStore';
import { useUiStore } from '../state/uiStore';
import { NAV_ITEMS, canOpen } from './navigation';
import styles from './Sidebar.module.scss';
import { SyncIndicator } from './SyncIndicator';
import { UserDot } from './UserDot';

export function Sidebar() {
  const screen = useUiStore((s) => s.screen);
  const setScreen = useUiStore((s) => s.setScreen);
  const { me } = useReadyData();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>Family Budget</div>
      <nav className={styles.nav}>
        {NAV_ITEMS.filter((item) => canOpen(me, item.screen)).map((item) => (
          <button
            key={item.screen}
            type="button"
            className={item.screen === screen ? `${styles.item} ${styles.active}` : styles.item}
            aria-current={item.screen === screen ? 'page' : undefined}
            onClick={() => setScreen(item.screen)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className={styles.bottom}>
        <SyncIndicator />
        <footer className={styles.footer}>
          <UserDot user={me} />
          <span className={styles.me}>{me.name}</span>
          <span className={styles.role}>{me.role === 'admin' ? 'Admin' : 'Thành viên'}</span>
        </footer>
      </div>
    </aside>
  );
}
