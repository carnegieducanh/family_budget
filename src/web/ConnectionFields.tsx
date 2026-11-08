import { useId } from 'react';
import styles from '../features/setup/SetupScreen.module.scss';

/** Hai ô dán link ứng dụng web và mã kết nối của Google Apps Script. */
export function ConnectionFields({
  url,
  secret,
  disabled,
  onUrl,
  onSecret,
}: {
  url: string;
  secret: string;
  disabled?: boolean;
  onUrl: (value: string) => void;
  onSecret: (value: string) => void;
}) {
  const id = useId();
  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`${id}-url`}>Link kết nối</label>
        <input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          placeholder="https://script.google.com/macros/s/.../exec"
          value={url}
          disabled={disabled}
          onChange={(e) => onUrl(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-key`}>Mã kết nối</label>
        <input
          id={`${id}-key`}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          value={secret}
          disabled={disabled}
          onChange={(e) => onSecret(e.target.value)}
        />
      </div>
    </>
  );
}
