import { useEffect, useLayoutEffect, useState, type ReactElement } from 'react';
import { Handshake, LayoutDashboard, Receipt, type LucideIcon } from 'lucide-react';
import { BrandMark } from './components/BrandMark';
import { Button } from './components/Button';
import { UserAvatar } from './components/UserDot';
import { useSmoothScroll } from './components/useSmoothScroll';
import { OverviewScreen } from './features/overview/OverviewScreen';
import { SettlementRequestDialog } from './features/settlement/SettlementRequestDialog';
import { SettlementScreen } from './features/settlement/SettlementScreen';
import { NewTransactionsDialog } from './features/transactions/NewTransactionsDialog';
import { TransactionEditor } from './features/transactions/TransactionEditor';
import { TransactionsScreen } from './features/transactions/TransactionsScreen';
import { useDataStore, useReadyData } from './state/dataStore';
import { useUiStore, type Screen } from './state/uiStore';
import { startSync } from './sync/appSync';
import { WebSettingsScreen } from './web/WebSettingsScreen';
import { WebSetupScreen } from './web/WebSetupScreen';
import { claimSingleTab } from './web/singleTab';
import styles from './App.web.module.scss';

// Bản web (điện thoại) của App.tsx: chỉ 3 màn Tổng quan, Khoản chi, Tất toán, chuyển bằng thanh
// tab ở đáy màn hình; Cài đặt mở bằng ảnh đại diện ở góc trên. Không có cập nhật app (trang web
// tự lên bản mới khi tải lại).

function App() {
  const status = useDataStore((s) => s.status);
  const [owner, setOwner] = useState<boolean | null>(null);

  useEffect(() => {
    void claimSingleTab().then((claimed) => {
      setOwner(claimed);
      if (claimed) void useDataStore.getState().init();
    });
  }, []);

  if (owner === false) return <OpenElsewhere />;
  if (owner === null || status === 'loading') {
    return <div className={styles.center}>Đang mở dữ liệu...</div>;
  }
  if (status === 'error') return <LoadError />;
  if (status === 'setup') return <WebSetupScreen />;
  return <MainLayout />;
}

const TABS: { screen: Screen; icon: LucideIcon; label: string }[] = [
  { screen: 'overview', icon: LayoutDashboard, label: 'Tổng quan' },
  { screen: 'transactions', icon: Receipt, label: 'Khoản chi' },
  { screen: 'settlement', icon: Handshake, label: 'Tất toán' },
];

const SCREENS: Partial<Record<Screen, () => ReactElement>> = {
  overview: OverviewScreen,
  transactions: TransactionsScreen,
  settlement: SettlementScreen,
  settings: WebSettingsScreen,
};

function MainLayout() {
  const screen = useUiStore((s) => s.screen);
  const setScreen = useUiStore((s) => s.setScreen);
  const saveError = useDataStore((s) => s.saveError);
  const { me } = useReadyData();
  const Current = SCREENS[screen] ?? OverviewScreen;
  const [contentRef, lenisRef] = useSmoothScroll();
  const onSettings = screen === 'settings';

  // Đổi màn hình thì về đầu trang, không giữ vị trí cuộn của màn trước.
  useLayoutEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true });
  }, [screen, lenisRef]);

  // Như app desktop: sinh khoản định kỳ của tháng này, đặt mốc báo khoản chi mới, rồi bắt đầu
  // lịch sync (chưa kết nối nơi sync thì mỗi lượt dừng ngay ở "chưa kết nối").
  useEffect(() => {
    useDataStore.getState().generateRecurring();
    useDataStore.getState().initNewTransactionsMark();
    startSync();
  }, []);

  return (
    <div className={styles.layout}>
      <header className={styles.top}>
        <button
          type="button"
          className={styles.brand}
          aria-label="Tổng quan"
          onClick={() => setScreen('overview')}
        >
          <BrandMark size={28} />
          <span className={styles.brandName}>Family Budget</span>
        </button>
        <button
          type="button"
          className={onSettings ? `${styles.profile} ${styles.profileActive}` : styles.profile}
          aria-label="Cài đặt"
          aria-current={onSettings ? 'page' : undefined}
          onClick={() => setScreen('settings')}
        >
          <UserAvatar user={me} size={32} />
        </button>
      </header>

      <main ref={contentRef} className={styles.content}>
        <div className={styles.inner}>
          {saveError && (
            <div className={styles.saveError} role="alert">
              <span>
                Không lưu được dữ liệu xuống máy: {saveError}. Thay đổi vẫn còn trong app.
              </span>
              <Button size="sm" onClick={() => useDataStore.getState().retrySave()}>
                Thử lưu lại
              </Button>
            </div>
          )}
          {/* key: mỗi lần đổi màn hình khối này dựng lại nên hiệu ứng hiện ra chạy lại. */}
          <div key={screen} className={styles.screen}>
            <Current />
          </div>
        </div>
      </main>

      <nav className={styles.tabs} aria-label="Màn hình">
        {TABS.map(({ screen: target, icon: Icon, label }) => {
          const current = target === screen;
          return (
            <button
              key={target}
              type="button"
              className={current ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              aria-current={current ? 'page' : undefined}
              onClick={() => setScreen(target)}
            >
              <Icon size={22} strokeWidth={current ? 2.2 : 1.8} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <TransactionEditor />
      <NewTransactionsDialog />
      <SettlementRequestDialog />
    </div>
  );
}

function LoadError() {
  const loadError = useDataStore((s) => s.loadError);
  return (
    <div className={styles.center}>
      <div className={styles.errorPanel}>
        <h1>Không mở được dữ liệu</h1>
        <p>{loadError}</p>
        <p>App chưa ghi gì đè lên dữ liệu này, dữ liệu cũ vẫn còn nguyên.</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Thử lại
        </Button>
      </div>
    </div>
  );
}

/** App đang mở ở tab hoặc cửa sổ khác của trình duyệt: hai nơi cùng ghi sẽ đè dữ liệu nhau. */
function OpenElsewhere() {
  return (
    <div className={styles.center}>
      <div className={styles.errorPanel}>
        <h1>Family Budget đang mở ở nơi khác</h1>
        <p>
          App đang mở ở một tab hoặc cửa sổ khác của trình duyệt này. Hãy dùng ở đó, hoặc đóng nơi
          đó rồi bấm Thử lại.
        </p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Thử lại
        </Button>
      </div>
    </div>
  );
}

export default App;
