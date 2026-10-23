import { useEffect, useState } from 'react';
import { Button } from './components/Button';
import { isAnyModalOpen } from './components/modalStack';
import { Sidebar } from './components/Sidebar';
import { OverviewScreen } from './features/overview/OverviewScreen';
import { SettlementScreen } from './features/settlement/SettlementScreen';
import { SetupScreen } from './features/setup/SetupScreen';
import { TransactionEditor } from './features/transactions/TransactionEditor';
import { TransactionsScreen } from './features/transactions/TransactionsScreen';
import { useDataStore } from './state/dataStore';
import { useUiStore } from './state/uiStore';
import { getDataFilePath } from './storage/localStore';
import styles from './App.module.scss';

function App() {
  const status = useDataStore((s) => s.status);

  useEffect(() => {
    void useDataStore.getState().init();
  }, []);

  if (status === 'loading') return <div className={styles.center}>Đang mở dữ liệu...</div>;
  if (status === 'error') return <LoadError />;
  if (status === 'setup') return <SetupScreen />;
  return <MainLayout />;
}

function MainLayout() {
  const screen = useUiStore((s) => s.screen);
  const saveError = useDataStore((s) => s.saveError);

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
      <main className={styles.content}>
        {saveError && (
          <div className={styles.saveError} role="alert">
            <span>Không lưu được dữ liệu xuống máy: {saveError}. Thay đổi vẫn còn trong app.</span>
            <Button size="sm" onClick={() => useDataStore.getState().retrySave()}>
              Thử lưu lại
            </Button>
          </div>
        )}
        {screen === 'overview' && <OverviewScreen />}
        {screen === 'transactions' && <TransactionsScreen />}
        {screen === 'settlement' && <SettlementScreen />}
      </main>
      <TransactionEditor />
    </div>
  );
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
