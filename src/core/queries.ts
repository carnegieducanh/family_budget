import { addMonths, toMonth } from './month';
import type { DataFile, Transaction } from './types';

// Truy vấn đọc dữ liệu cho các màn hình. Mọi hàm đều bỏ qua bản ghi đã xóa mềm.

export function transactionsInMonth(
  transactions: readonly Transaction[],
  month: string,
): Transaction[] {
  return transactions.filter((tx) => !tx.deleted && tx.date.startsWith(`${month}-`));
}

export function sumAmounts(transactions: readonly Transaction[]): number {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

export type TransactionSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

/** Sắp xếp ổn định: khi bằng nhau thì xét thời điểm nhập, rồi tới id. */
export function sortTransactions(
  transactions: readonly Transaction[],
  sort: TransactionSort,
): Transaction[] {
  const direction = sort.endsWith('desc') ? -1 : 1;
  const byAmount = sort.startsWith('amount');
  return [...transactions].sort((a, b) => {
    const primary = byAmount ? a.amount - b.amount : a.date.localeCompare(b.date);
    if (primary !== 0) return primary * direction;
    const created = a.createdAt.localeCompare(b.createdAt);
    if (created !== 0) return created * direction;
    return a.id.localeCompare(b.id);
  });
}

/** Bỏ dấu tiếng Việt và viết thường, để tìm "dien" ra "Điện". */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export interface TransactionFilter {
  categoryId?: string | null;
  paidBy?: string | null;
  search?: string;
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filter: TransactionFilter,
): Transaction[] {
  const query = normalizeSearchText(filter.search ?? '');
  return transactions.filter(
    (tx) =>
      (!filter.categoryId || tx.categoryId === filter.categoryId) &&
      (!filter.paidBy || tx.paidBy === filter.paidBy) &&
      (query === '' || normalizeSearchText(tx.note).includes(query)),
  );
}

/** Các khoản gần nhất trong tháng: ngày mới nhất trước, cùng ngày thì khoản nhập sau trước. */
export function recentTransactions(
  transactions: readonly Transaction[],
  month: string,
  count = 5,
): Transaction[] {
  return sortTransactions(transactions, 'date-desc')
    .filter((tx) => !tx.deleted && tx.date.startsWith(`${month}-`))
    .slice(0, count);
}

export interface CategorySpending {
  categoryId: string;
  amount: number;
}

/** Tổng chi theo danh mục trong tháng, nhiều nhất trước. */
export function spendingByCategory(
  transactions: readonly Transaction[],
  month: string,
): CategorySpending[] {
  const totals = new Map<string, number>();
  for (const tx of transactionsInMonth(transactions, month)) {
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount);
  }
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId));
}

/**
 * Các tháng có hoạt động (có khoản chi hoặc đã tất toán), luôn gồm tháng hiện tại,
 * sắp xếp mới nhất trước. Dùng cho lịch sử tất toán.
 */
export function activeMonths(data: DataFile, now: Date): string[] {
  const months = new Set<string>([toMonth(now)]);
  for (const tx of data.transactions) {
    if (!tx.deleted) months.add(tx.date.slice(0, 7));
  }
  for (const record of data.months) {
    if (!record.deleted && record.settledAt) months.add(record.month);
  }
  return [...months].sort().reverse();
}

/** Tháng trước và tháng sau, dùng cho bộ chọn tháng. */
export function adjacentMonths(month: string): { prev: string; next: string } {
  return { prev: addMonths(month, -1), next: addMonths(month, 1) };
}
