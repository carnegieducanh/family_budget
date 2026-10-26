import { useState } from 'react';
import { formatDateTime, formatMonthLabel } from '../../core/month';
import { incomingRequests, type IncomingRequest } from '../../core/settlement';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useOpenModalCount } from '../../components/modalStack';
import { UserFace } from '../../components/UserDot';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { useSyncStore } from '../../state/syncStore';
import styles from './SettlementRequestDialog.module.scss';
import { SettlementSentence } from './SettlementText';

function keyOf({ settlement, request }: IncomingRequest): string {
  return `${settlement.month}@${request.at}`;
}

/**
 * Popup cho người nhận yêu cầu tất toán của người kia: "Đồng ý" thì tháng được đánh dấu đã
 * thanh toán, "Để sau" thì ẩn đến lần mở app sau (vẫn đồng ý được ở màn Tất toán).
 */
export function SettlementRequestDialog() {
  const { data, me, users } = useReadyData();
  const synced = useSyncStore((s) => s.last !== null);
  const modalCount = useOpenModalCount();
  // Yêu cầu đang hiện, và các yêu cầu đã bấm "Để sau" trong lần mở app này.
  const [showing, setShowing] = useState<string | null>(null);
  const [later, setLater] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const waiting = incomingRequests(data, me.id).filter((item) => !later.has(keyOf(item)));
  const current = waiting.find((item) => keyOf(item) === showing);
  if (!current) {
    // Chỉ mở sau lượt sync đầu tiên (yêu cầu có thể đã bị hủy ở máy kia) và khi không có modal
    // nào khác đang mở, để không chồng lên popup khoản chi mới hay form đang nhập dở.
    const next = waiting[0];
    if (next && synced && modalCount === 0) setShowing(keyOf(next));
    else if (showing !== null) setShowing(null);
    return null;
  }

  const { settlement, request } = current;
  const requester = users.find((u) => u.id === request.by);

  function accept() {
    try {
      useDataStore.getState().acceptSettlement(settlement.month);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Đóng bằng nút X, Esc hay bấm ra ngoài cũng như "Để sau".
  function postpone() {
    if (current) setLater(new Set(later).add(keyOf(current)));
    setError(null);
  }

  return (
    <Modal
      title="Yêu cầu tất toán"
      onClose={postpone}
      width={480}
      footer={
        <>
          <Button onClick={postpone}>Để sau</Button>
          <Button variant="primary" onClick={accept} autoFocus>
            Đồng ý
          </Button>
        </>
      }
    >
      <p className={styles.intro}>
        <UserFace user={requester} withName /> đề nghị tất toán {formatMonthLabel(settlement.month)}{' '}
        lúc {formatDateTime(request.at)}:
      </p>
      <div className={styles.sentence}>
        <SettlementSentence settlement={settlement} users={users} size={26} />
      </div>
      <p className={styles.hint}>Đồng ý thì tháng này được đánh dấu “Đã thanh toán”.</p>
      {error && <p className={styles.error}>{error}</p>}
    </Modal>
  );
}
