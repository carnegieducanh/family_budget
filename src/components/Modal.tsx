import { X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './Modal.module.scss';
import { openModals, pushModal, removeModal } from './modalStack';
import { useSmoothScroll } from './useSmoothScroll';

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
  const [bodyRef] = useSmoothScroll();

  useEffect(() => {
    pushModal(id);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === id) {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      removeModal(id);
    };
  }, [id]);

  // data-lenis-prevent: popup nằm trong vùng nội dung (không qua portal) nên lăn chuột trên popup
  // không được cuộn trang phía sau; thân popup có cuộn mượt riêng.
  return (
    <div
      className={styles.overlay}
      data-lenis-prevent
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        // Rộng theo cỡ chữ người dùng chọn; cửa sổ hẹp thì max-width 100% chặn lại.
        style={{ width: `calc(${width}px * var(--font-scale))` }}
      >
        <div className={styles.header}>
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            className={styles.close}
            onClick={onClose}
            aria-label="Đóng"
            title="Đóng (Esc)"
          >
            <X size={18} />
          </Button>
        </div>
        <div ref={bodyRef} className={styles.body}>
          {children}
        </div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
