import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatYen } from '../../core/money';
import { formatDate, formatMonthLabel } from '../../core/month';
import { findMonthRecord, isLocked } from '../../core/monthLock';
import { can } from '../../core/permissions';
import {
  filterTransactions,
  sortTransactions,
  sumAmounts,
  transactionsInMonth,
  type TransactionSort,
} from '../../core/queries';
import { active } from '../../core/records';
import type { Transaction } from '../../core/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CategoryLabel } from '../../components/CategoryLabel';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MonthHeader } from '../../components/MonthHeader';
import { shortcutLabel } from '../../components/shortcut';
import { UserDot, UserName } from '../../components/UserDot';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import { useNow } from '../../state/useNow';
import styles from './TransactionsScreen.module.scss';

const SORT_OPTIONS: { value: TransactionSort; label: string }[] = [
  { value: 'date-desc', label: 'Ngày: mới nhất trước' },
  { value: 'date-asc', label: 'Ngày: cũ nhất trước' },
  { value: 'amount-desc', label: 'Số tiền: cao nhất trước' },
  { value: 'amount-asc', label: 'Số tiền: thấp nhất trước' },
];

export function TransactionsScreen() {
  const month = useUiStore((s) => s.month);
  const openCreate = useUiStore((s) => s.openCreate);
  const openEdit = useUiStore((s) => s.openEdit);
  const { data, me, users } = useReadyData();
  const now = useNow();

  const [categoryId, setCategoryId] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TransactionSort>('date-desc');
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locked = isLocked(month, now, findMonthRecord(data.months, month));
  const monthTransactions = transactionsInMonth(data.transactions, month);
  const rows = sortTransactions(
    filterTransactions(monthTransactions, { categoryId, paidBy, search }),
    sort,
  );
  const filtered = rows.length !== monthTransactions.length;
  const categoriesById = new Map(data.categories.map((c) => [c.id, c]));
  const usersById = new Map(data.users.map((u) => [u.id, u]));
  const categoryOptions = active(data.categories).sort((a, b) => a.order - b.order);

  function confirmDelete() {
    if (!deleting) return;
    try {
      useDataStore.getState().deleteTransaction(deleting.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setDeleting(null);
  }

  return (
    <>
      <MonthHeader title="Khoản chi" />

      <div className={styles.toolbar}>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Lọc theo danh mục"
        >
          <option value="">Tất cả danh mục</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <select
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          aria-label="Lọc theo người trả"
        >
          <option value="">Cả hai người trả</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} trả
            </option>
          ))}
        </select>
        <div className={styles.searchBox}>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo ghi chú"
            aria-label="Tìm theo ghi chú"
            className={styles.search}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as TransactionSort)}
          aria-label="Sắp xếp"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={openCreate} title={shortcutLabel('N')}>
          <Plus size={16} aria-hidden="true" />
          Thêm khoản chi
        </Button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <Card>
        {monthTransactions.length === 0 ? (
          <p className={styles.empty}>Chưa có khoản chi nào trong {formatMonthLabel(month)}.</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>Không có khoản nào khớp bộ lọc.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Danh mục</th>
                  <th>Ghi chú</th>
                  <th className={styles.num}>Số tiền</th>
                  <th>Người trả</th>
                  <th>Người nhập</th>
                  {!locked && <th aria-label="Thao tác" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => (
                  <tr
                    key={tx.id}
                    className={locked ? undefined : styles.clickable}
                    onClick={locked ? undefined : () => openEdit(tx.id)}
                  >
                    <td className={styles.date}>{formatDate(tx.date).slice(0, 5)}</td>
                    <td>
                      <span
                        className={styles.category}
                        title={categoriesById.get(tx.categoryId)?.name}
                      >
                        <CategoryLabel category={categoriesById.get(tx.categoryId)} />
                      </span>
                    </td>
                    <td className={styles.note}>
                      <span className={styles.noteRow}>
                        {tx.recurringId && <span className={styles.tag}>định kỳ</span>}
                        {tx.note && (
                          <span className={styles.noteText} title={tx.note}>
                            {tx.note}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={styles.amount}>{formatYen(tx.amount)}</td>
                    <td>
                      <UserName user={usersById.get(tx.paidBy)} />
                    </td>
                    <td>
                      <UserDot
                        user={usersById.get(tx.createdBy)}
                        title={`Nhập bởi ${usersById.get(tx.createdBy)?.name ?? 'không rõ'}`}
                      />
                    </td>
                    {!locked && (
                      <td className={styles.actions} onClick={(e) => e.stopPropagation()}>
                        <span className={styles.rowActions}>
                          {can(me, 'transaction:edit', tx) ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                iconOnly
                                onClick={() => openEdit(tx.id)}
                                aria-label="Sửa"
                                title="Sửa"
                              >
                                <Pencil size={15} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                iconOnly
                                className={styles.deleteButton}
                                onClick={() => setDeleting(tx)}
                                aria-label="Xóa"
                                title="Xóa"
                              >
                                <Trash2 size={15} />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              iconOnly
                              onClick={() => openEdit(tx.id)}
                              aria-label="Xem"
                              title="Xem"
                            >
                              <Eye size={15} />
                            </Button>
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {monthTransactions.length > 0 && (
          <p className={styles.summary}>
            <span>
              {rows.length} khoản
              {filtered && ` (đã lọc từ ${monthTransactions.length} khoản)`}
            </span>
            <span>
              Tổng <strong className={styles.amount}>{formatYen(sumAmounts(rows))}</strong>
            </span>
          </p>
        )}
      </Card>

      {deleting && (
        <ConfirmDialog
          title="Xóa khoản chi?"
          confirmLabel="Xóa"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        >
          Xóa khoản {formatYen(deleting.amount)} ngày {formatDate(deleting.date)}
          {deleting.note && ` (${deleting.note})`}?
        </ConfirmDialog>
      )}
    </>
  );
}
