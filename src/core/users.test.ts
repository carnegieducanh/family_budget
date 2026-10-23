import { describe, expect, it } from 'vitest';
import { householdUsers } from './household';
import { upsert } from './records';
import { NOW, makeData } from './testing';
import type { MutationContext, User } from './types';
import { transferAdmin, updateUser } from './users';

function setup() {
  const { data, a, b } = makeData();
  const ctx: MutationContext = { data, userId: a, now: NOW };
  const [admin, member] = data.users as [User, User];
  return { data, a, b, ctx, admin, member };
}

describe('updateUser', () => {
  it('đổi tên và màu', () => {
    const { ctx, member } = setup();
    expect(updateUser(member, { name: ' Bình  An ', color: '#12ab9f' }, ctx)).toMatchObject({
      name: 'Bình An',
      color: '#12AB9F',
      role: 'member',
    });
  });

  it('từ chối tên trống, tên trùng người kia, màu sai', () => {
    const { ctx, member } = setup();
    expect(() => updateUser(member, { name: '', color: '#123456' }, ctx)).toThrow('tên');
    expect(() => updateUser(member, { name: 'an', color: '#123456' }, ctx)).toThrow('khác nhau');
    expect(() => updateUser(member, { name: 'Bình', color: 'red' }, ctx)).toThrow('Màu');
  });
});

describe('transferAdmin', () => {
  it('chuyển quyền admin: luôn còn đúng một admin', () => {
    const { data, ctx, b } = setup();
    const changed = transferAdmin(b, ctx);
    expect(changed.map((u) => [u.id, u.role])).toEqual([
      ['user-a', 'member'],
      ['user-b', 'admin'],
    ]);
    const users = changed.reduce((list, u) => upsert(list, u), data.users);
    expect(users.filter((u) => u.role === 'admin')).toHaveLength(1);
    expect(householdUsers({ ...data, users })[0].id).toBe(b);
  });

  it('người đó đã là admin → báo lỗi', () => {
    const { ctx, a } = setup();
    expect(() => transferAdmin(a, ctx)).toThrow('đã là admin');
  });
});
