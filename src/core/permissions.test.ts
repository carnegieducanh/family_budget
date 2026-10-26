import { describe, expect, it } from 'vitest';
import { assertCan, can, canEditProfile, type Action } from './permissions';
import { makeData, makeTx } from './testing';
import type { User } from './types';

function users(): { admin: User; member: User } {
  const { data } = makeData();
  const [admin, member] = data.users as [User, User];
  return { admin, member };
}

// Bảng ở SPEC mục 7: [thao tác, admin, người dùng thường].
const TABLE: Array<[Action, boolean, boolean]> = [
  ['transaction:create', true, true],
  ['month:settle', true, true],
  ['categories:manage', true, false],
  ['budgets:manage', true, false],
  ['recurring:manage', true, false],
  ['month:unlock', true, false],
  ['csv:import', true, false],
  ['backup:restore', true, false],
  ['csv:export', true, true],
  ['reports:view', true, true],
  ['users:manage', true, false],
  ['encryption:manage', true, false],
  ['sync:configure', true, true],
];

describe('can', () => {
  it.each(TABLE)('%s: admin %s, người dùng thường %s', (action, adminCan, memberCan) => {
    const { admin, member } = users();
    expect(can(admin, action)).toBe(adminCan);
    expect(can(member, action)).toBe(memberCan);
  });

  it('người dùng thường chỉ sửa, xóa được khoản do mình nhập', () => {
    const { admin, member } = users();
    const own = makeTx({ date: '2026-10-01', amount: 100, paidBy: admin.id, createdBy: member.id });
    const others = makeTx({
      date: '2026-10-01',
      amount: 100,
      paidBy: member.id,
      createdBy: admin.id,
    });
    expect(can(member, 'transaction:edit', own)).toBe(true);
    expect(can(member, 'transaction:edit', others)).toBe(false);
    expect(can(member, 'transaction:edit')).toBe(false);
  });

  it('admin sửa, xóa được mọi khoản', () => {
    const { admin, member } = users();
    const others = makeTx({
      date: '2026-10-01',
      amount: 100,
      paidBy: member.id,
      createdBy: member.id,
    });
    expect(can(admin, 'transaction:edit', others)).toBe(true);
  });

  it('không rõ người dùng → không có quyền gì', () => {
    expect(can(undefined, 'transaction:create')).toBe(false);
  });
});

describe('canEditProfile', () => {
  it('mỗi người đổi được tên và ảnh của mình, admin đổi được của cả hai', () => {
    const { admin, member } = users();
    expect(canEditProfile(member, member)).toBe(true);
    expect(canEditProfile(member, admin)).toBe(false);
    expect(canEditProfile(admin, admin)).toBe(true);
    expect(canEditProfile(admin, member)).toBe(true);
    expect(canEditProfile(undefined, member)).toBe(false);
  });
});

describe('assertCan', () => {
  it('báo lỗi tiếng Việt khi không có quyền', () => {
    const { admin, member } = users();
    const others = makeTx({
      date: '2026-10-01',
      amount: 100,
      paidBy: admin.id,
      createdBy: admin.id,
    });
    expect(() => assertCan(member, 'transaction:edit', others)).toThrow('do chính mình nhập');
    expect(() => assertCan(member, 'budgets:manage')).toThrow('Chỉ admin');
    expect(() => assertCan(admin, 'budgets:manage')).not.toThrow();
  });
});
