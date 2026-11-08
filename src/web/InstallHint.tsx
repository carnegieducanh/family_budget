import { Share } from 'lucide-react';
import { isInstalledApp } from './registerServiceWorker';
import styles from './InstallHint.module.scss';

/**
 * Hướng dẫn thêm bản web vào Màn hình chính, hiện khi đang mở trong tab trình duyệt của điện
 * thoại. Trên iPhone, app ở Màn hình chính có kho dữ liệu riêng (không chung với Safari), và
 * Safari có thể xóa dữ liệu của trang lâu không mở; nên thêm vào Màn hình chính trước khi kết nối.
 */
export function InstallHint({ beforeSetup = false }: { beforeSetup?: boolean }) {
  if (isInstalledApp() || navigator.maxTouchPoints === 0) return null;
  return (
    <div className={styles.hint}>
      <strong>Dùng như app trên iPhone</strong>
      <ol>
        <li>
          Mở trang này bằng Safari, bấm nút Chia sẻ <Share size={14} aria-label="Chia sẻ" />.
        </li>
        <li>Chọn “Thêm vào MH chính” → Thêm.</li>
        <li>
          {beforeSetup
            ? 'Mở Family Budget từ Màn hình chính rồi mới kết nối: app ở Màn hình chính không dùng chung dữ liệu với Safari.'
            : 'Mở Family Budget từ Màn hình chính và kết nối lại ở đó (app ở Màn hình chính không dùng chung dữ liệu với Safari).'}
        </li>
      </ol>
    </div>
  );
}
