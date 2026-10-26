import { sortTransactions } from './queries';
import type { DataFile, Transaction } from './types';

// Báo khoản chi người kia mới thêm, khi mở app. Mỗi máy nhớ một mốc (settings.json, không
// sync): `createdAt` của khoản mới nhất đã báo. Khoản người kia nhập sau mốc này là khoản mới.
// Mốc lấy từ đồng hồ máy kia (nơi khoản được nhập), nên giờ hai máy lệch nhau không làm sót khoản.

/** Mốc khi chưa có khoản nào của người kia: mọi khoản người kia nhập sau đó đều là mới. */
export const NOTHING_SEEN = new Date(0).toISOString();

/**
 * Khoản do người kia tự tay nhập. Bỏ qua khoản sinh từ định kỳ (app tự tạo mỗi tháng) và khoản
 * người sửa sau cùng không phải người nhập: máy này đã sửa nó, hoặc admin nhập từ CSV thay cho
 * người kia.
 */
function enteredByOther(tx: Transaction, userId: string): boolean {
  return tx.createdBy !== userId && tx.updatedBy === tx.createdBy && !tx.recurringId;
}

/** Khoản người kia thêm sau `seenUntil`, chưa xóa, ngày mới nhất trước. */
export function newTransactionsFromOther(
  data: DataFile,
  userId: string,
  seenUntil: string,
): Transaction[] {
  return sortTransactions(
    data.transactions.filter(
      (tx) => !tx.deleted && enteredByOther(tx, userId) && tx.createdAt > seenUntil,
    ),
    'date-desc',
  );
}

/**
 * Mốc lần đầu (vừa thiết lập, hoặc vừa cập nhật lên bản có tính năng này): coi mọi khoản của
 * người kia đang có trên máy là đã xem, để không báo lại cả lịch sử.
 */
export function initialSeenMark(data: DataFile, userId: string): string {
  return data.transactions
    .filter((tx) => enteredByOther(tx, userId))
    .reduce((mark, tx) => (tx.createdAt > mark ? tx.createdAt : mark), NOTHING_SEEN);
}

/** Mốc mới sau khi người dùng đã xem các khoản `shown`. */
export function seenMarkAfter(seenUntil: string, shown: readonly Transaction[]): string {
  return shown.reduce((mark, tx) => (tx.createdAt > mark ? tx.createdAt : mark), seenUntil);
}
