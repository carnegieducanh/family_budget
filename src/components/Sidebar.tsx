import { useReadyData } from '../state/dataStore';
import { useUiStore } from '../state/uiStore';
import { BrandMark } from './BrandMark';
import { NAV_ITEMS, canOpen } from './navigation';
import styles from './Sidebar.module.scss';
import { SyncIndicator } from './SyncIndicator';
import { ThemeSwitcher } from './ThemeSwitcher';
import { UserAvatar } from './UserDot';

const GROUP_LABEL = { main: null, manage: 'Quản lý', system: null } as const;

export function Sidebar() {
  const screen = useUiStore((s) => s.screen);
  const setScreen = useUiStore((s) => s.setScreen);
  const { me, users } = useReadyData();
  const visible = NAV_ITEMS.filter((item) => canOpen(me, item.screen));

  function renderGroup(group: keyof typeof GROUP_LABEL) {
    const items = visible.filter((item) => item.group === group);
    if (items.length === 0) return null;
    const label = GROUP_LABEL[group];
    return (
      <div className={styles.group}>
        {label && <div className={styles.groupLabel}>{label}</div>}
        {items.map(({ screen: target, icon: Icon, label: text }) => {
          const current = target === screen;
          return (
            <button
              key={target}
              type="button"
              className={current ? `${styles.item} ${styles.active}` : styles.item}
              aria-current={current ? 'page' : undefined}
              onClick={() => setScreen(target)}
            >
              <Icon size={18} strokeWidth={current ? 2.2 : 1.8} aria-hidden="true" />
              {text}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <BrandMark size={32} />
        <div className={styles.brandText}>
          <span className={styles.brandName}>Family Budget</span>
          <span className={styles.household}>{users.map((u) => u.name).join(' & ')}</span>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Màn hình">
        {renderGroup('main')}
        {renderGroup('manage')}
      </nav>

      <div className={styles.bottom}>
        <nav aria-label="Hệ thống">{renderGroup('system')}</nav>
        <SyncIndicator />
        <ThemeSwitcher compact />
        <footer className={styles.footer}>
          <UserAvatar user={me} />
          <div className={styles.meText}>
            <span className={styles.me}>{me.name}</span>
            <span className={styles.role}>{me.role === 'admin' ? 'Admin' : 'Thành viên'}</span>
          </div>
        </footer>
      </div>
    </aside>
  );
}
