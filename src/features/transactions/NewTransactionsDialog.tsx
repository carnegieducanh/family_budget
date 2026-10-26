import { useState } from 'react';
import { formatYen } from '../../core/money';
import { formatDate } from '../../core/month';
import { newTransactionsFromOther } from '../../core/newTransactions';
import { sumAmounts } from '../../core/queries';
import type { Transaction } from '../../core/types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { UserFace } from '../../components/UserDot';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { useSyncStore } from '../../state/syncStore';
import styles from './NewTransactionsDialog.module.scss';

/** Popup khi mở app: các khoản chi người kia đã thêm từ lần báo trước (core/newTransactions.ts). */
export function NewTransactionsDialog() {
  const { data, me, users } = useReadyData();
  const synced = useSyncStore((s) => s.last !== null);
  const seenUntil = useDataStore((s) => s.settings?.newTransactionsSeenUntil);
  // null: chưa kiểm tra. Kiểm tra một lần mỗi lần mở app, khi lượt sync đầu tiên xong (đã có
  // dữ liệu mới nhất của máy kia, hoặc không sync được thì báo những gì đã có trên máy). Danh
  // sách được chụp lại lúc đó; khoản đến sau sẽ báo ở lần mở app sau.
  const [shown, setShown] = useState<Transaction[] | null>(null);
  if (shown === null && synced && seenUntil !== undefined) {
    setShown(newTransactionsFromOther(data, me.id, seenUntil));
  }
  if (!shown || shown.length === 0) return null;

  const other = users.find((u) => u.id !== me.id);
  const categoriesById = new Map(data.categories.map((c) => [c.id, c]));
  const usersById = new Map(data.users.map((u) => [u.id, u]));

  // Đóng bằng cách nào (nút, Esc, bấm ra ngoài) cũng tính là đã xem.
  function dismiss() {
    if (!shown) return;
    useDataStore.getState().markNewTransactionsSeen(shown);
    setShown([]);
  }

  return (
    <Modal
      title="Khoản chi mới"
      onClose={dismiss}
      width={480}
      footer={
        <>
          <span className={styles.total}>
            Tổng <strong>{formatYen(sumAmounts(shown))}</strong>
          </span>
          <Button variant="primary" onClick={dismiss} autoFocus>
            Đã xem
          </Button>
        </>
      }
    >
      <p className={styles.intro}>
        <UserFace user={other} withName /> đã thêm {shown.length} khoản chi.
      </p>
      <ul className={styles.list}>
        {shown.map((tx) => {
          const category = categoriesById.get(tx.categoryId);
          // Bản cũ của app ở máy kia vẫn chọn được người trả khác người nhập.
          const payer = tx.paidBy !== tx.createdBy ? usersById.get(tx.paidBy) : undefined;
          const details = [payer && `${payer.id === me.id ? 'Bạn' : payer.name} trả`, tx.note]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={tx.id} className={styles.row}>
              <span className={styles.tile} aria-hidden="true">
                {category?.icon ?? '❔'}
              </span>
              <span className={styles.main}>
                <span className={styles.category}>{category?.name ?? 'Không rõ'}</span>
                {details && <span className={styles.note}>{details}</span>}
              </span>
              <span className={styles.date}>{formatDate(tx.date).slice(0, 5)}</span>
              <span className={styles.amount}>{formatYen(tx.amount)}</span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
