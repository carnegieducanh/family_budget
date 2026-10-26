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

/** "Bình trả An ¥42,500" với ảnh đại diện thay tên, hoặc "Hai người đã trả bằng nhau". */
export function SettlementSentence({ settlement, users, size = 22 }: SettlementTextProps) {
  if (settlement.amount === 0) return <>Hai người đã trả bằng nhau</>;
  return (
    <span className={styles.line}>
      <UserFace user={findUser(users, settlement.payer)} size={size} />
      trả
      <UserFace user={findUser(users, settlement.receiver)} size={size} />
      {formatYen(settlement.amount)}
    </span>
  );
}

/** "Bình → An" cho bảng lịch sử, với ảnh đại diện thay tên. */
export function SettlementDirection({ settlement, users, size = 22 }: SettlementTextProps) {
  if (settlement.amount === 0) return <>—</>;
  return (
    <span className={styles.line}>
      <UserFace user={findUser(users, settlement.payer)} size={size} />
      →
      <UserFace user={findUser(users, settlement.receiver)} size={size} />
    </span>
  );
}
