import { formatYen } from '../../core/money';
import type { Settlement } from '../../core/settlement';
import type { User } from '../../core/types';

function nameOf(users: readonly User[], id: string | null): string {
  return users.find((u) => u.id === id)?.name ?? 'không rõ';
}

/** "Bình trả An ¥42,500" hoặc "Hai người đã trả bằng nhau". */
export function describeSettlement(settlement: Settlement, users: readonly User[]): string {
  if (settlement.amount === 0) return 'Hai người đã trả bằng nhau';
  return `${nameOf(users, settlement.payer)} trả ${nameOf(users, settlement.receiver)} ${formatYen(settlement.amount)}`;
}

/** "Bình → An" cho bảng lịch sử. */
export function describeDirection(settlement: Settlement, users: readonly User[]): string {
  if (settlement.amount === 0) return '—';
  return `${nameOf(users, settlement.payer)} → ${nameOf(users, settlement.receiver)}`;
}

export function userName(users: readonly User[], id: string | null | undefined): string {
  return nameOf(users, id ?? null);
}
