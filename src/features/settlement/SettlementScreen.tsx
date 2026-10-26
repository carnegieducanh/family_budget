import {
  Circle,
  CircleCheck,
  Clock,
  Handshake,
  Hourglass,
  Minus,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { formatYen } from '../../core/money';
import {
  formatDate,
  formatDateTime,
  formatMonthLabel,
  formatMonthShort,
  isPastMonth,
  lastDayOfMonth,
} from '../../core/month';
import { activeMonths } from '../../core/queries';
import {
  canSettle,
  computeSettlement,
  findMonthRecord,
  isProvisional,
  settlementChange,
  settlementRequest,
  type Settlement,
  type SettlementChange,
  type SettlementRequest,
} from '../../core/settlement';
import type { DataFile, MonthRecord, User } from '../../core/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { MonthHeader } from '../../components/MonthHeader';
import { UserFace } from '../../components/UserDot';
import { useDataStore, useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import { useNow } from '../../state/useNow';
import styles from './SettlementScreen.module.scss';
import { SettlementDirection, SettlementSentence } from './SettlementText';

export function SettlementScreen() {
  const month = useUiStore((s) => s.month);
  const { data, me, users } = useReadyData();
  const now = useNow();
  const [error, setError] = useState<string | null>(null);

  const userIds = [users[0].id, users[1].id] as const;
  const settlement = computeSettlement(data.transactions, userIds, month);
  const record = findMonthRecord(data.months, month);

  function run(action: (month: string) => void) {
    try {
      action(month);
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
          {isProvisional(record, month, now) && (
            <span className={styles.provisional}>Tạm tính</span>
          )}
        </div>

        {canSettle(month, now) ? (
          <SettlementStatus
            settlement={settlement}
            record={record}
            change={settlementChange(record, settlement)}
            request={settlementRequest(record, settlement)}
            me={me}
            users={users}
            onRequest={() => run(useDataStore.getState().requestSettlement)}
            onAccept={() => run(useDataStore.getState().acceptSettlement)}
            onCancel={() => run(useDataStore.getState().cancelSettlementRequest)}
          />
        ) : (
          <p className={styles.hint}>
            Nút “Tất toán” sẽ hiện vào ngày cuối tháng, {formatDate(lastDayOfMonth(month))}.
          </p>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </Card>

      <Card title="Lịch sử các tháng" className={styles.history}>
        <HistoryTable data={data} users={users} now={now} selected={month} />
      </Card>
    </>
  );
}

interface SettlementStatusProps {
  settlement: Settlement;
  record: MonthRecord | undefined;
  change: SettlementChange | null;
  request: SettlementRequest | null;
  me: User;
  users: readonly User[];
  onRequest: () => void;
  onAccept: () => void;
  onCancel: () => void;
}

/**
 * Tất toán hai bước: một người bấm "Tất toán" (gửi yêu cầu), người kia đồng ý ở popup hoặc ở
 * đây thì tháng mới được đánh dấu đã thanh toán.
 */
function SettlementStatus({
  settlement,
  record,
  change,
  request,
  me,
  users,
  onRequest,
  onAccept,
  onCancel,
}: SettlementStatusProps) {
  const findUser = (id: string | undefined) => users.find((u) => u.id === id);

  if (request && !request.outdated) {
    if (request.by === me.id) {
      return (
        <div className={styles.waiting}>
          <span className={styles.noticeText}>
            <Hourglass size={16} aria-hidden="true" />
            <span>
              Đã gửi yêu cầu tất toán lúc {formatDateTime(request.at)}, đang chờ{' '}
              <UserFace user={users.find((u) => u.id !== me.id)} size={22} withName /> đồng ý.
            </span>
          </span>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Hủy yêu cầu
          </Button>
        </div>
      );
    }
    return (
      <div className={styles.incoming}>
        <span className={styles.noticeText}>
          <Hourglass size={16} aria-hidden="true" />
          <span>
            <UserFace user={findUser(request.by)} size={22} withName /> đề nghị tất toán lúc{' '}
            {formatDateTime(request.at)}.
          </span>
        </span>
        <Button size="sm" variant="primary" onClick={onAccept}>
          Đồng ý
        </Button>
      </div>
    );
  }
  if (change) {
    return (
      <div className={styles.warning} role="alert">
        <span className={styles.noticeText}>
          <TriangleAlert size={16} aria-hidden="true" />
          <span>
            Số tiền đã thay đổi sau khi tất toán: {formatYen(change.before)} →{' '}
            {formatYen(change.after)}
            {change.beforePayer !== change.afterPayer && ' (đổi người trả bù)'}
          </span>
        </span>
        <Button size="sm" onClick={onRequest} disabled={settlement.amount === 0}>
          Tất toán lại
        </Button>
      </div>
    );
  }
  if (record?.settledAt) {
    return (
      <p className={styles.settled}>
        <CircleCheck size={16} aria-hidden="true" /> Đã thanh toán lúc{' '}
        {formatDateTime(record.settledAt)} ·{' '}
        <UserFace user={findUser(record.settledBy)} size={22} withName /> xác nhận
      </p>
    );
  }
  if (request?.outdated) {
    return (
      <div className={styles.warning} role="alert">
        <span className={styles.noticeText}>
          <TriangleAlert size={16} aria-hidden="true" />
          <span>
            Số tiền đã thay đổi sau khi gửi yêu cầu tất toán: {formatYen(request.amount)} →{' '}
            {formatYen(settlement.amount)}
            {request.payer !== settlement.payer && ' (đổi người trả bù)'}
          </span>
        </span>
        <span className={styles.buttons}>
          {request.by === me.id && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Hủy yêu cầu
            </Button>
          )}
          {settlement.amount > 0 && (
            <Button size="sm" onClick={onRequest}>
              Gửi lại yêu cầu
            </Button>
          )}
        </span>
      </div>
    );
  }
  if (settlement.amount === 0) {
    return <p className={styles.hint}>Không ai cần trả bù tháng này.</p>;
  }
  return (
    <div className={styles.actions}>
      <Button variant="primary" onClick={onRequest}>
        Tất toán
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
  const record = findMonthRecord(data.months, settlement.month);
  const request = settlementRequest(record, settlement);
  if (request && !request.outdated) {
    return { icon: Hourglass, label: 'Chờ đồng ý', tone: 'toneWarning' };
  }
  if (settlementChange(record, settlement)) {
    return { icon: TriangleAlert, label: 'Đổi sau tất toán', tone: 'toneWarning' };
  }
  if (record?.settledAt) return { icon: CircleCheck, label: 'Đã thanh toán', tone: 'toneGood' };
  if (!isPastMonth(settlement.month, now)) {
    return { icon: Clock, label: 'Tạm tính', tone: 'toneMuted' };
  }
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
