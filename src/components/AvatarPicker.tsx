import { ImageUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { AVATAR_EMOJIS } from '../core/avatar';
import styles from './AvatarPicker.module.scss';
import { imageFileToAvatar } from './avatarImage';
import { Button } from './Button';
import { UserAvatar, type AvatarUser } from './UserDot';

interface AvatarPickerProps {
  /** Tên, màu và avatar đang chọn (để xem trước). */
  user: AvatarUser;
  onChange: (avatar: string | null) => void;
  /** Có nút bỏ ảnh để quay về chữ cái đầu. Lúc thiết lập thì bắt buộc có avatar nên không có. */
  allowClear?: boolean;
}

/** Chọn ảnh đại diện: ảnh trên máy (cắt vuông, thu nhỏ) hoặc một emoji. */
export function AvatarPicker({ user, onChange, allowClear = false }: AvatarPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      onChange(await imageFileToAvatar(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.picker}>
      <div className={styles.top}>
        <UserAvatar user={user} size={64} />
        <div className={styles.actions}>
          <div className={styles.buttons}>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={loading}>
              <ImageUp size={14} aria-hidden="true" />
              {loading ? 'Đang xử lý ảnh...' : 'Chọn ảnh từ máy...'}
            </Button>
            {allowClear && user.avatar && (
              <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                Bỏ ảnh đại diện
              </Button>
            )}
          </div>
          <span className={styles.hint}>Ảnh được cắt vuông lấy phần giữa.</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          hidden
          onChange={(e) => {
            void pickFile(e.target.files?.[0]);
            e.target.value = ''; // chọn lại đúng file đó vẫn nhận
          }}
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.label}>Hoặc chọn emoji</div>
      <div className={styles.emojis} role="group" aria-label="Emoji làm ảnh đại diện">
        {AVATAR_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={emoji === user.avatar ? `${styles.emoji} ${styles.selected}` : styles.emoji}
            aria-pressed={emoji === user.avatar}
            onClick={() => onChange(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
