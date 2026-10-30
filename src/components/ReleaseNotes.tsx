import { useState } from 'react';
import { releaseNoteItems } from '../core/changelog';
import styles from './ReleaseNotes.module.scss';
import { useSmoothScroll } from './useSmoothScroll';

/** Ghi chú phát hành dạng danh sách (các dòng `- ...` trong docs/CHANGELOG.md). */
export function ReleaseNotes({ notes }: { notes: string }) {
  const [scrollRef] = useSmoothScroll();
  return (
    <ul ref={scrollRef} className={styles.list}>
      {releaseNoteItems(notes).map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Ghi chú phát hành ẩn sau một liên kết, bấm mới hiện, để popup cập nhật và Cài đặt gọn.
 * Không có ghi chú thì không hiện gì.
 */
export function ReleaseNotesToggle({ notes, label }: { notes: string; label: string }) {
  const [open, setOpen] = useState(false);
  if (releaseNoteItems(notes).length === 0) return null;
  return (
    <div className={styles.toggle}>
      <button
        type="button"
        className={styles.link}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Ẩn chi tiết' : label}
      </button>
      {open && <ReleaseNotes notes={notes} />}
    </div>
  );
}
