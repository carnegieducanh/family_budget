import { getBudgetAmount } from '../../core/budget';
import { formatYen } from '../../core/money';
import { formatDate } from '../../core/month';
import { findMonthRecord, isLocked, isPastMonth } from '../../core/monthLock';
import {
  recentTransactions,
  spendingByCategory,
  sumAmounts,
  transactionsInMonth,
} from '../../core/queries';
import { computeSettlement } from '../../core/settlement';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CategoryLabel } from '../../components/CategoryLabel';
import { MonthHeader } from '../../components/MonthHeader';
import { shortcutLabel } from '../../components/shortcut';
import { UserDot, UserName } from '../../components/UserDot';
import { useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import { useNow } from '../../state/useNow';
import { describeSettlement } from '../settlement/describe';
import { BudgetMeter } from './BudgetMeter';
import { CategoryBreakdown } from './CategoryBreakdown';
import styles from './OverviewScreen.module.scss';

export function OverviewScreen() {
  const month = useUiStore((s) => s.month);
  const openCreate = useUiStore((s) => s.openCreate);
  const openEdit = useUiStore((s) => s.openEdit);
  const setScreen = useUiStore((s) => s.setScreen);
  const { data, users } = useReadyData();
  const now = useNow();

  const monthTransactions = transactionsInMonth(data.transactions, month);
  const total = sumAmounts(monthTransactions);
  const settlement = computeSettlement(data.transactions, [users[0].id, users[1].id], month);
  const locked = isLocked(month, now, findMonthRecord(data.months, month));
  const recent = recentTransactions(data.transactions, month, 5);
  const categoriesById = new Map(data.categories.map((c) => [c.id, c]));
  const usersById = new Map(data.users.map((u) => [u.id, u]));

  return (
    <>
      <MonthHeader title="Tổng quan" />

      <div className={styles.grid}>
        <Card title="Tổng chi tháng">
          <div className={styles.hero}>{formatYen(total)}</div>
          <div className={styles.sub}>{monthTransactions.length} khoản chi</div>
          <BudgetMeter spent={total} budget={getBudgetAmount(data.budgets, month, null)} />
        </Card>

        <Card title="Mỗi người đã trả">
          <ul className={styles.paidList}>
            {users.map((user) => (
              <li key={user.id}>
                <UserName user={user} />
                <span className={styles.num}>{formatYen(settlement.paidByUser[user.id] ?? 0)}</span>
              </li>
            ))}
          </ul>
          <div className={styles.settlement}>
            <span className={styles.settlementText}>{describeSettlement(settlement, users)}</span>
            {!isPastMonth(month, now) && <span className={styles.badge}>Tạm tính</span>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setScreen('settlement')}>
            Xem tất toán →
          </Button>
        </Card>

        <Card title="Chi theo danh mục" className={styles.wide}>
          <CategoryBreakdown
            spending={spendingByCategory(data.transactions, month)}
            categories={data.categories}
          />
        </Card>

        <Card
          title="5 khoản gần nhất"
          className={styles.wide}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setScreen('transactions')}>
                Xem tất cả
              </Button>
              <Button variant="primary" size="sm" onClick={openCreate} title={shortcutLabel('N')}>
                + Thêm khoản chi
              </Button>
            </>
          }
        >
          {recent.length === 0 ? (
            <p className={styles.empty}>Chưa có khoản chi nào trong tháng.</p>
          ) : (
            <ul className={styles.recent}>
              {recent.map((tx) => (
                <li key={tx.id}>
                  <button
                    type="button"
                    className={styles.recentRow}
                    onClick={() => openEdit(tx.id)}
                    disabled={locked}
                  >
                    <span className={styles.date}>{formatDate(tx.date).slice(0, 5)}</span>
                    <span className={styles.category}>
                      <CategoryLabel category={categoriesById.get(tx.categoryId)} />
                    </span>
                    <span className={styles.note}>{tx.note}</span>
                    <UserDot
                      user={usersById.get(tx.paidBy)}
                      title={`${usersById.get(tx.paidBy)?.name ?? 'Không rõ'} trả`}
                    />
                    <span className={styles.num}>{formatYen(tx.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
