import { describe, expect, it } from 'vitest';
import { householdUsers, sameHousehold } from './household';
import { touch } from './records';
import { makeData } from './testing';

describe('householdUsers', () => {
  it('admin đứng trước, không phụ thuộc thứ tự trong mảng', () => {
    const { data } = makeData();
    const reversed = { ...data, users: [...data.users].reverse() };
    expect(householdUsers(data).map((u) => u.id)).toEqual(['user-a', 'user-b']);
    expect(householdUsers(reversed).map((u) => u.id)).toEqual(['user-a', 'user-b']);
  });

  it('báo lỗi nếu không có đúng 2 người', () => {
    const { data } = makeData();
    expect(() => householdUsers({ ...data, users: data.users.slice(0, 1) })).toThrow(
      'đúng 2 người',
    );
  });
});

describe('sameHousehold', () => {
  it('cùng tập người dùng → cùng gia đình, kể cả khi tên đã đổi', () => {
    const { data } = makeData();
    const renamed = data.users.map((u) => touch(u, { name: `${u.name} 2` }, 'user-a', new Date()));
    expect(sameHousehold(data, { ...data, users: renamed })).toBe(true);
  });

  it('người dùng khác → gia đình khác', () => {
    const { data } = makeData();
    const other = data.users.map((u, i) => ({ ...u, id: `other-${i}` }));
    expect(sameHousehold(data, { ...data, users: other })).toBe(false);
    expect(sameHousehold(data, { ...data, users: data.users.slice(0, 1) })).toBe(false);
  });
});
