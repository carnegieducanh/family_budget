import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { Button } from './components/Button';
import { isAnyModalOpen } from './components/modalStack';
import { canOpen } from './components/navigation';
import { Sidebar } from './components/Sidebar';
import { UpdateBanner } from './components/UpdateBanner';
import { BudgetScreen } from './features/budget/BudgetScreen';
import { CategoriesScreen } from './features/categories/CategoriesScreen';
import { OverviewScreen } from './features/overview/OverviewScreen';
import { RecurringScreen } from './features/recurring/RecurringScreen';
import { ReportsScreen } from './features/reports/ReportsScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { SettlementScreen } from './features/settlement/SettlementScreen';
import { SetupScreen } from './features/setup/SetupScreen';
import { TransactionEditor } from './features/transactions/TransactionEditor';
import { TransactionsScreen } from './features/transactions/TransactionsScreen';
import { useDataStore, useReadyData } from './state/dataStore';
import { useSyncStore } from './state/syncStore';
import { useUiStore, type Screen } from './state/uiStore';
import { getDataFilePath } from './storage/localStore';
import { startSync } from './sync/appSync';
import { startUpdateChecks } from './update/appUpdate';
import styles from './App.module.scss';

function App() {
  const status = useDataStore((s) => s.status);

  // Kiểm tra bản cập nhật ngay và mỗi 24 giờ (SPEC mục 9), kể cả khi đang thiết lập lần đầu:
  // máy mới cài bản cũ có thể cần cập nhật mới đọc được dữ liệu của máy kia.
  useEffect(() => {
    void useDataStore.getState().init();
    startUpdateChecks();
  }, []);

  if (status === 'loading') return <div className={styles.center}>Đang mở dữ liệu...</div>;
  if (status === 'error') return <LoadError />;
  if (status === 'setup') return <SetupScreen />;
  return <MainLayout />;
}

const SCREENS: Record<Screen, () => ReactElement> = {
  overview: OverviewScreen,
  transactions: TransactionsScreen,
  settlement: SettlementScreen,
  reports: ReportsScreen,
  budget: BudgetScreen,
  categories: CategoriesScreen,
  recurring: RecurringScreen,
  settings: SettingsScreen,
};

function MainLayout() {
  const selected = useUiStore((s) => s.screen);
  const saveError = useDataStore((s) => s.saveError);
  const { me } = useReadyData();
  // Vừa mất quyền admin (chuyển quyền, hoặc nhận từ máy kia) thì quay về Tổng quan.
  const screen = canOpen(me, selected) ? selected : 'overview';
  const Current = SCREENS[screen];
  const contentRef = useRef<HTMLElement>(null);

  // Đổi màn hình thì về đầu trang, không giữ vị trí cuộn của màn trước.
  useLayoutEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [screen]);

  // Khi mở app: sinh khoản định kỳ của tháng này (SPEC mục 6), rồi bắt đầu lịch sync:
  // sync ngay, định kỳ, khi focus lại cửa sổ và sau mỗi thay đổi (SPEC mục 5).
  useEffect(() => {
    useDataStore.getState().generateRecurring();
    startSync();
  }, []);

  // Ctrl/Cmd + N: thêm khoản chi mới từ bất kỳ màn hình nào.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault(); // chặn WebView mở cửa sổ mới
        if (!isAnyModalOpen()) useUiStore.getState().openCreate();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main ref={contentRef} className={styles.content}>
        <div className={styles.inner}>
          <UpdateBanner />
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
          <SyncBanner />
          {/* key: mỗi lần đổi màn hình khối này dựng lại nên hiệu ứng hiện ra chạy lại. */}
          <div key={screen} className={styles.screen}>
            <Current />
          </div>
        </div>
      </main>
      <TransactionEditor />
    </div>
  );
}

/** Cảnh báo sync cần người dùng xử lý; các cảnh báo nhẹ chỉ hiện ở góc sidebar. */
function SyncBanner() {
  const last = useSyncStore((s) => s.last);
  const screen = useUiStore((s) => s.screen);
  if (last?.kind === 'schema-too-new') {
    return (
      <div className={styles.banner} role="alert">
        Máy kia đang dùng bản mới hơn, hãy cập nhật app. Đồng bộ tạm dừng cho đến khi cập nhật.
      </div>
    );
  }
  const reasons = last?.kind === 'ok' ? last.problems.map((p) => p.reason) : [];
  if (reasons.includes('encrypted') || reasons.includes('decrypt-failed')) {
    return (
      <div className={`${styles.banner} ${styles.warning}`} role="alert">
        <span>
          {reasons.includes('encrypted')
            ? 'Máy kia đã mã hóa dữ liệu trên Drive. Nhập mật khẩu chung ở Cài đặt → Mã hóa để tiếp tục nhận dữ liệu từ máy kia.'
            : 'Không giải mã được dữ liệu từ máy kia, kiểm tra mật khẩu ở Cài đặt → Mã hóa.'}
        </span>
        {screen !== 'settings' && (
          <Button size="sm" onClick={() => useUiStore.getState().setScreen('settings')}>
            Mở Cài đặt
          </Button>
        )}
      </div>
    );
  }
  if (last?.kind === 'ok' && last.clockSkew) {
    return (
      <div className={`${styles.banner} ${styles.warning}`} role="alert">
        Giờ trên hai máy lệch nhau. Hãy bật “Đặt giờ tự động” trên cả hai máy, nếu không bản sửa
        trên máy chạy nhanh giờ có thể đè bản sửa mới hơn trên máy kia.
      </div>
    );
  }
  return null;
}

function LoadError() {
  const loadError = useDataStore((s) => s.loadError);
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    getDataFilePath().then(setPath, () => setPath(null));
  }, []);

  return (
    <div className={styles.center}>
      <div className={styles.errorPanel}>
        <h1>Không mở được dữ liệu</h1>
        <p>{loadError}</p>
        {path && (
          <p>
            File: <code>{path}</code>
          </p>
        )}
        <p>App chưa ghi gì lên file này, dữ liệu cũ vẫn còn nguyên.</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Thử lại
        </Button>
      </div>
    </div>
  );
}

export default App;
