import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './Modal.module.scss';
import { openModals } from './modalStack';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ title, onClose, children, footer, width = 440 }: ModalProps) {
  const id = useId();
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    openModals.push(id);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === id) {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      openModals.splice(openModals.indexOf(id), 1);
    };
  }, [id]);

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        style={{ width }}
      >
        <h2 id={`${id}-title`} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
