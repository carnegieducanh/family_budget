import {
  Circle,
  CircleCheck,
  Clock,
  Handshake,
  Minus,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { formatYen } from '../../core/money';
import { formatDateTime, formatMonthLabel, formatMonthShort } from '../../core/month';
import { findMonthRecord, isPastMonth } from '../../core/monthLock';
import { activeMonths } from '../../core/queries';
import {
  computeSettlement,
  settlementChange,
  type Settlement,
  type SettlementChange,
} from '../../core/settlement';
import type { DataFile, User } from '../../core/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MonthHeader } from '../../components/MonthHeader';
import { UserFace } from '../../components/UserDot';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import { useNow } from '../../state/useNow';
import styles from './SettlementScreen.module.scss';
import { SettlementDirection, SettlementSentence } from './SettlementText';

export function SettlementScreen() {
  const month = useUiStore((s) => s.month);
  const { data, users } = useReadyData();
  const now = useNow();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userIds = [users[0].id, users[1].id] as const;
  const settlement = computeSettlement(data.transactions, userIds, month);
  const record = findMonthRecord(data.months, month);
  const change = settlementChange(record, settlement);
  const past = isPastMonth(month, now);

  function markSettled() {
    setConfirming(false);
    try {
      useDataStore.getState().markSettled(month);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <MonthHeader title="Tất toán" />

      <Card title={`Chia đều 50/50 — ${formatMonthLabel(month)}`}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Người</th>
                <th className={styles.num}>Đã trả</th>
                <th className={styles.num}>Phần phải chịu</th>
                <th className={styles.num}>Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const paid = settlement.paidByUser[user.id] ?? 0;
                const diff = paid - settlement.sharePerPerson;
                return (
                  <tr key={user.id}>
                    <td>
                      <UserFace user={user} size={28} withName />
                    </td>
                    <td className={styles.num}>{formatYen(paid)}</td>
                    <td className={styles.num}>{formatYen(settlement.sharePerPerson)}</td>
                    <td className={styles.num}>
                      {diff > 0 ? '+' : ''}
                      {formatYen(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Tổng</td>
                <td className={styles.num}>{formatYen(settlement.total)}</td>
                <td className={styles.num}>{formatYen(settlement.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={styles.result}>
          <span className={styles.resultIcon} aria-hidden="true">
            <Handshake size={20} />
          </span>
          <div className={styles.resultText}>
            <SettlementSentence settlement={settlement} users={users} size={30} />
          </div>
          {!past && <span className={styles.provisional}>Tạm tính</span>}
        </div>

        {past ? (
          <SettledStatus
            settlement={settlement}
            record={record}
            change={change}
            users={users}
            onMark={() => setConfirming(true)}
          />
        ) : (
          <p className={styles.hint}>
            Số tiền được chốt khi sang tháng mới; lúc đó có thể đánh dấu “Đã thanh toán”.
          </p>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </Card>

      <Card title="Lịch sử các tháng" className={styles.history}>
        <HistoryTable data={data} users={users} now={now} selected={month} />
      </Card>

      {confirming && (
        <ConfirmDialog
          title="Xác nhận đã thanh toán?"
          confirmLabel="Đã thanh toán"
          onCancel={() => setConfirming(false)}
          onConfirm={markSettled}
        >
          <SettlementSentence settlement={settlement} users={users} size={20} /> cho{' '}
          {formatMonthLabel(month)}.
        </ConfirmDialog>
      )}
    </>
  );
}

interface SettledStatusProps {
  settlement: Settlement;
  record: ReturnType<typeof findMonthRecord>;
  change: SettlementChange | null;
  users: readonly User[];
  onMark: () => void;
}

function SettledStatus({ settlement, record, change, users, onMark }: SettledStatusProps) {
  if (change) {
    return (
      <div className={styles.warning} role="alert">
        <span className={styles.warningText}>
          <TriangleAlert size={16} aria-hidden="true" />
          <span>
            Số tiền đã thay đổi sau khi tất toán: {formatYen(change.before)} →{' '}
            {formatYen(change.after)}
            {change.beforePayer !== change.afterPayer && ' (đổi người trả bù)'}
          </span>
        </span>
        <Button size="sm" onClick={onMark} disabled={settlement.amount === 0}>
          Xác nhận lại đã thanh toán
        </Button>
      </div>
    );
  }
  if (record?.settledAt) {
    return (
      <p className={styles.settled}>
        <CircleCheck size={16} aria-hidden="true" /> Đã thanh toán lúc{' '}
        {formatDateTime(record.settledAt)} ·{' '}
        <UserFace user={users.find((u) => u.id === record.settledBy)} size={22} withName /> xác nhận
      </p>
    );
  }
  if (settlement.amount === 0) {
    return <p className={styles.hint}>Không ai cần trả bù tháng này.</p>;
  }
  return (
    <div className={styles.actions}>
      <Button variant="primary" onClick={onMark}>
        Đã thanh toán
      </Button>
    </div>
  );
}

type HistoryStatus = {
  icon: LucideIcon;
  label: string;
  tone: 'toneMuted' | 'toneGood' | 'toneWarning';
};

function historyStatus(settlement: Settlement, data: DataFile, now: Date): HistoryStatus {
  if (!isPastMonth(settlement.month, now))
    return { icon: Clock, label: 'Tạm tính', tone: 'toneMuted' };
  const record = findMonthRecord(data.months, settlement.month);
  if (settlementChange(record, settlement)) {
    return { icon: TriangleAlert, label: 'Đổi sau tất toán', tone: 'toneWarning' };
  }
  if (record?.settledAt) return { icon: CircleCheck, label: 'Đã thanh toán', tone: 'toneGood' };
  if (settlement.amount === 0) {
    return { icon: Minus, label: 'Không cần trả bù', tone: 'toneMuted' };
  }
  return { icon: Circle, label: 'Chưa thanh toán', tone: 'toneWarning' };
}

interface HistoryTableProps {
  data: DataFile;
  users: readonly [User, User];
  now: Date;
  selected: string;
}

function HistoryTable({ data, users, now, selected }: HistoryTableProps) {
  const setMonth = useUiStore((s) => s.setMonth);
  const userIds = [users[0].id, users[1].id] as const;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Tháng</th>
            <th className={styles.num}>Tổng chi</th>
            <th className={styles.num}>Số tiền bù</th>
            <th>Ai trả ai</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {activeMonths(data, now).map((month) => {
            const settlement = computeSettlement(data.transactions, userIds, month);
            const status = historyStatus(settlement, data, now);
            return (
              <tr
                key={month}
                className={month === selected ? styles.selectedRow : styles.clickable}
                onClick={() => setMonth(month)}
              >
                <td>{formatMonthShort(month)}</td>
                <td className={styles.num}>{formatYen(settlement.total)}</td>
                <td className={styles.num}>{formatYen(settlement.amount)}</td>
                <td>
                  <SettlementDirection settlement={settlement} users={users} />
                </td>
                <td className={styles[status.tone]}>
                  <span className={styles.status}>
                    <status.icon size={14} aria-hidden="true" /> {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
