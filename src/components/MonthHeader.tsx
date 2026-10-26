import { CalendarDays, ChevronLeft, ChevronRight, Lock, LockOpen } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime, formatMonthLabel, toMonth } from '../core/month';
import { findMonthRecord, isLocked, isPastMonth, isTemporarilyUnlocked } from '../core/monthLock';
import { can } from '../core/permissions';
import { useDataStore, useReadyData } from '../state/dataStore';
import { useUiStore } from '../state/uiStore';
import { useNow } from '../state/useNow';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './MonthHeader.module.scss';

/** Tiêu đề màn hình kèm bộ chọn tháng `‹ Tháng 10/2026 ›` và trạng thái khóa tháng. */
export function MonthHeader({ title }: { title: string }) {
  const month = useUiStore((s) => s.month);
  const shiftMonth = useUiStore((s) => s.shiftMonth);
  const setMonth = useUiStore((s) => s.setMonth);
  const { data, me } = useReadyData();
  const now = useNow();
  const [error, setError] = useState<string | null>(null);
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  const record = findMonthRecord(data.months, month);
  const locked = isLocked(month, now, record);
  const tempUnlocked = isPastMonth(month, now) && isTemporarilyUnlocked(record, now);
  const isAdmin = can(me, 'month:unlock');
  const currentMonth = toMonth(now);

  function run(action: () => void) {
    try {
      action();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>

      {/* Trạng thái khóa nằm cạnh tiêu đề, không cạnh bộ chọn tháng: đổi tháng thì nhãn và nút
          hiện/ẩn, nếu đứng bên phải chúng sẽ đẩy bộ chọn tháng qua lại. */}
      <div className={styles.lock}>
        {locked && (
          <span className={styles.lockedBadge} title="Tháng đã qua được tự động khóa">
            <Lock size={13} aria-hidden="true" /> Đã khóa
          </span>
        )}
        {tempUnlocked && record?.manualUnlockUntil && (
          <span className={styles.unlockedBadge}>
            <LockOpen size={13} aria-hidden="true" /> Mở khóa tạm đến{' '}
            {formatDateTime(record.manualUnlockUntil)}
          </span>
        )}
        {isAdmin && locked && (
          <Button size="sm" onClick={() => setConfirmUnlock(true)}>
            Mở khóa 24 giờ
          </Button>
        )}
        {isAdmin && tempUnlocked && (
          <Button size="sm" onClick={() => run(() => useDataStore.getState().relockMonth(month))}>
            Khóa lại
          </Button>
        )}
      </div>

      <div className={styles.picker}>
        {month !== currentMonth && (
          <Button variant="secondary" size="sm" onClick={() => setMonth(currentMonth)}>
            Về tháng này
          </Button>
        )}
        <div className={styles.stepper}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => shiftMonth(-1)}
            aria-label="Tháng trước"
            title="Tháng trước"
          >
            <ChevronLeft size={18} />
          </Button>
          <span className={styles.month}>
            <CalendarDays size={15} aria-hidden="true" />
            {formatMonthLabel(month)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => shiftMonth(1)}
            aria-label="Tháng sau"
            title="Tháng sau"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {confirmUnlock && (
        <ConfirmDialog
          title={`Mở khóa ${formatMonthLabel(month)}?`}
          confirmLabel="Mở khóa 24 giờ"
          onCancel={() => setConfirmUnlock(false)}
          onConfirm={() => {
            setConfirmUnlock(false);
            run(() => useDataStore.getState().unlockMonth(month));
          }}
        >
          Trong 24 giờ tới, cả hai người đều thêm, sửa, xóa được khoản chi của tháng này. Hết 24 giờ
          tháng tự khóa lại; bạn cũng có thể bấm “Khóa lại” sớm hơn.
        </ConfirmDialog>
      )}
    </header>
  );
}
