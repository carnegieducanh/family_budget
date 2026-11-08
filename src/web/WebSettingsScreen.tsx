import { Card } from '../components/Card';
import { FontSizeSwitcher } from '../components/FontSizeSwitcher';
import { PageHeader } from '../components/PageHeader';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { UsersSettings } from '../features/settings/UsersSettings';
import { useDataStore } from '../state/dataStore';
import styles from '../features/settings/SettingsScreen.module.scss';

/**
 * Cài đặt của bản web: giao diện, người dùng, đồng bộ. Danh mục, ngân sách, định kỳ, backup và
 * CSV làm trên app máy tính.
 */
export function WebSettingsScreen() {
  const deviceId = useDataStore((s) => s.settings?.deviceId);
  return (
    <div className={styles.page}>
      <PageHeader title="Cài đặt" />
      <div className={styles.cards}>
        <Card title="Giao diện">
          <dl className={styles.rows}>
            <dt>Theme</dt>
            <dd>
              <ThemeSwitcher />
            </dd>
            <dt>Cỡ chữ</dt>
            <dd>
              <FontSizeSwitcher />
            </dd>
          </dl>
        </Card>
        <UsersSettings />
        <Card title="Đồng bộ">
          <p className={styles.small}>
            Bản web chưa đồng bộ với app trên máy tính: khoản chi nhập ở đây chỉ nằm trên trình
            duyệt này.
          </p>
        </Card>
        <Card title="Máy này">
          <dl className={styles.rows}>
            <dt>Mã máy</dt>
            <dd>
              <code className={styles.path}>{deviceId}</code>
            </dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}
