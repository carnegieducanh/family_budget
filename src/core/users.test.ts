import { describe, expect, it } from 'vitest';
import { householdUsers } from './household';
import { upsert } from './records';
import { NOW, makeData } from './testing';
import type { MutationContext, User } from './types';
import { setAvatar, transferAdmin, updateUser } from './users';

function setup() {
  const { data, a, b } = makeData();
  const ctx: MutationContext = { data, userId: a, now: NOW };
  const [admin, member] = data.users as [User, User];
  return { data, a, b, ctx, admin, member };
}

describe('updateUser', () => {
  it('đổi tên, giữ nguyên màu', () => {
    const { ctx, member } = setup();
    expect(updateUser(member, { name: ' Bình  An ' }, ctx)).toMatchObject({
      name: 'Bình An',
      color: member.color,
      role: 'member',
    });
  });

  it('từ chối tên trống, tên trùng người kia', () => {
    const { ctx, member } = setup();
    expect(() => updateUser(member, { name: '' }, ctx)).toThrow('tên');
    expect(() => updateUser(member, { name: 'an' }, ctx)).toThrow('khác nhau');
  });
});

describe('setAvatar', () => {
  it('đặt emoji, đổi sang ảnh, rồi bỏ ảnh', () => {
    const { ctx, member } = setup();
    const withEmoji = setAvatar(member, '🐻', ctx);
    expect(withEmoji).toMatchObject({ avatar: '🐻', updatedBy: 'user-a' });
    expect(withEmoji.updatedAt).toBe(NOW.toISOString());

    const image = 'data:image/jpeg;base64,/9j/4AAQ';
    expect(setAvatar(withEmoji, image, ctx).avatar).toBe(image);

    const cleared = setAvatar(withEmoji, null, ctx);
    expect('avatar' in cleared).toBe(false);
    expect(cleared.name).toBe(member.name);
  });

  it('từ chối giá trị không phải ảnh hay emoji', () => {
    const { ctx, member } = setup();
    expect(() => setAvatar(member, 'abc', ctx)).toThrow('emoji');
  });

  it('đổi tên vẫn giữ ảnh đại diện', () => {
    const { ctx, member } = setup();
    const withEmoji = setAvatar(member, '🐻', ctx);
    expect(updateUser(withEmoji, { name: 'Bình' }, ctx).avatar).toBe('🐻');
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
