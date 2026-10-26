import { checkAvatar } from './avatar';
import { DomainError } from './errors';
import { active, touch } from './records';
import type { MutationContext, User } from './types';

// Người dùng và vai trò (SPEC mục 7, 8). Luôn có đúng 2 người và đúng một admin.

// Màu của người dùng không đổi được nữa: giữ màu mặc định lúc thiết lập (nền ảnh chữ cái đầu).
export interface UserInput {
  name: string;
}

export function updateUser(existing: User, input: UserInput, ctx: MutationContext): User {
  if (existing.deleted) throw new DomainError('Không tìm thấy người dùng.');
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new DomainError('Hãy nhập tên.');
  if (name.length > 40) throw new DomainError('Tên tối đa 40 ký tự.');
  const other = active(ctx.data.users).find((u) => u.id !== existing.id);
  if (other && other.name.trim().toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi')) {
    throw new DomainError('Tên 2 người phải khác nhau.');
  }
  return touch(existing, { name }, ctx.userId, ctx.now);
}

/** Đặt ảnh đại diện, hoặc bỏ (`null`) để hiện lại chữ cái đầu của tên. */
export function setAvatar(existing: User, avatar: string | null, ctx: MutationContext): User {
  if (existing.deleted) throw new DomainError('Không tìm thấy người dùng.');
  const next = touch(existing, {}, ctx.userId, ctx.now);
  if (avatar === null) delete next.avatar;
  else next.avatar = checkAvatar(avatar);
  return next;
}

/**
 * Chuyển quyền admin cho người kia: người đó thành admin, mọi admin khác thành người
 * dùng thường. Trả về các bản ghi người dùng thay đổi.
 */
export function transferAdmin(targetId: string, ctx: MutationContext): User[] {
  const users = active(ctx.data.users);
  const target = users.find((u) => u.id === targetId);
  if (!target) throw new DomainError('Không tìm thấy người dùng.');
  if (target.role === 'admin') throw new DomainError(`${target.name} đã là admin.`);
  return users
    .map((user) => ({ user, role: user.id === targetId ? 'admin' : 'member' }) as const)
    .filter(({ user, role }) => user.role !== role)
    .map(({ user, role }) => touch(user, { role }, ctx.userId, ctx.now));
}
