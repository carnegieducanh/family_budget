import { DomainError } from './errors';
import { active } from './records';
import type { DataFile, User } from './types';

/**
 * Hai người dùng của gia đình: admin trước, rồi theo thời điểm tạo, rồi theo id.
 * Không dựa vào thứ tự trong mảng, vì merge sắp xếp lại các bản ghi theo id.
 */
export function householdUsers(data: DataFile): [User, User] {
  const users = active(data.users).sort(
    (a, b) =>
      Number(b.role === 'admin') - Number(a.role === 'admin') ||
      (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const [first, second] = users;
  if (!first || !second || users.length !== 2) {
    throw new DomainError('Dữ liệu phải có đúng 2 người dùng.');
  }
  return [first, second];
}

/**
 * Hai bộ dữ liệu thuộc cùng một gia đình khi có cùng tập người dùng (theo id).
 * Gộp hai gia đình khác nhau sẽ ra 4 người, nên file như vậy bị bỏ qua khi sync.
 */
export function sameHousehold(a: DataFile, b: DataFile): boolean {
  const idsA = new Set(a.users.map((u) => u.id));
  const idsB = new Set(b.users.map((u) => u.id));
  return idsA.size === idsB.size && [...idsA].every((id) => idsB.has(id));
}
