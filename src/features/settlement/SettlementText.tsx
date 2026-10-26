import type { ReactNode } from 'react';
import { formatYen } from '../../core/money';
import type { Settlement } from '../../core/settlement';
import type { User } from '../../core/types';
import { UserFace } from '../../components/UserDot';
import styles from './SettlementText.module.scss';

interface SettlementTextProps {
  settlement: Settlement;
  users: readonly User[];
  /** Cỡ ảnh đại diện, theo cỡ chữ của câu. */
  size?: number;
}

function findUser(users: readonly User[], id: string | null): User | undefined {
  return users.find((u) => u.id === id);
}

interface SettlementSentenceProps extends SettlementTextProps {
  /** Đặt ngay sau số tiền (ví dụ nhãn "Tạm tính"), xuống dòng cùng số tiền khi hẹp. */
  suffix?: ReactNode;
}

/** "Bình trả An ¥42,500" với ảnh đại diện cạnh tên, hoặc "Hai người đã trả bằng nhau". */
export function SettlementSentence({
  settlement,
  users,
  size = 22,
  suffix,
}: SettlementSentenceProps) {
  if (settlement.amount === 0) {
    return (
      <span className={styles.line}>
        Hai người đã trả bằng nhau
        {suffix}
      </span>
    );
  }
  return (
    <span className={styles.line}>
      <UserFace user={findUser(users, settlement.payer)} size={size} withName />
      trả
      <UserFace user={findUser(users, settlement.receiver)} size={size} withName />
      <span className={styles.amountGroup}>
        <span className={styles.amount}>{formatYen(settlement.amount)}</span>
        {suffix}
      </span>
    </span>
  );
}

/** "Bình → An" cho bảng lịch sử, với ảnh đại diện cạnh tên. */
export function SettlementDirection({ settlement, users, size = 22 }: SettlementTextProps) {
  if (settlement.amount === 0) return <>—</>;
  return (
    <span className={styles.direction}>
      <UserFace user={findUser(users, settlement.payer)} size={size} withName />
      →
      <UserFace user={findUser(users, settlement.receiver)} size={size} withName />
    </span>
  );
}
