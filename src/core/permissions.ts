import { DomainError } from './errors';
import type { Transaction, User } from './types';

// Phân quyền (SPEC mục 7). Mục đích là tránh sửa nhầm, không phải bảo mật thật: ai có quyền
// vào thư mục Drive vẫn sửa được file. Dùng chung cho UI (ẩn, khóa nút) và store (chặn thao tác).

export type Action =
  | 'transaction:create'
  /** Sửa hoặc xóa một khoản chi; cần truyền khoản chi đó. */
  | 'transaction:edit'
  | 'month:settle'
  | 'month:unlock'
  | 'categories:manage'
  | 'budgets:manage'
  | 'recurring:manage'
  | 'csv:import'
  | 'csv:export'
  | 'backup:restore'
  | 'reports:view'
  | 'users:manage'
  /** Bật, tắt mã hóa, đặt hoặc đổi mật khẩu (máy thứ hai nhập mật khẩu đã đặt thì không cần). */
  | 'encryption:manage'
  | 'sync:configure';

/** Thao tác người dùng thường cũng làm được. */
const MEMBER_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  'transaction:create',
  'month:settle',
  'csv:export',
  'reports:view',
  'sync:configure',
]);

export function can(user: User | undefined, action: Action, record?: Transaction): boolean {
  if (!user || user.deleted) return false;
  if (user.role === 'admin') return true;
  if (action === 'transaction:edit') return record?.createdBy === user.id;
  return MEMBER_ACTIONS.has(action);
}

/** Tên và ảnh đại diện: mỗi người tự đổi của mình, admin đổi được của cả hai. */
export function canEditProfile(user: User | undefined, target: User): boolean {
  if (!user || user.deleted) return false;
  return user.id === target.id || can(user, 'users:manage');
}

const DENIED_MESSAGE: Partial<Record<Action, string>> = {
  'transaction:edit': 'Bạn chỉ sửa, xóa được khoản do chính mình nhập.',
};

/** Ném DomainError nếu không có quyền. Dùng trong mọi thao tác dữ liệu của store. */
export function assertCan(user: User | undefined, action: Action, record?: Transaction): void {
  if (can(user, action, record)) return;
  throw new DomainError(DENIED_MESSAGE[action] ?? 'Chỉ admin được làm thao tác này.');
}
