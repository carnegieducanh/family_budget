import { useReadyData } from '../state/dataStore';
import { useUiStore, type Screen } from '../state/uiStore';
import styles from './Sidebar.module.scss';
import { UserDot } from './UserDot';

const NAV_ITEMS: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'overview', icon: '📊', label: 'Tổng quan' },
  { screen: 'transactions', icon: '🧾', label: 'Khoản chi' },
  { screen: 'settlement', icon: '🤝', label: 'Tất toán' },
];

export function Sidebar() {
  const screen = useUiStore((s) => s.screen);
  const setScreen = useUiStore((s) => s.setScreen);
  const { me } = useReadyData();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>Family Budget</div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
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
      <footer className={styles.footer}>
        <UserDot user={me} />
        <span className={styles.me}>{me.name}</span>
        <span className={styles.role}>{me.role === 'admin' ? 'Admin' : 'Thành viên'}</span>
      </footer>
    </aside>
  );
}
