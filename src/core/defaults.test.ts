import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, createDefaultCategories, createInitialData } from './defaults';
import { localTime } from './testing';

describe('createDefaultCategories', () => {
  it('tạo 12 danh mục với id cố định, thứ tự 1–12', () => {
    const categories = createDefaultCategories('user-a', localTime(2026, 10, 23));
    expect(categories).toHaveLength(12);
    expect(categories.map((c) => c.id)).toEqual(DEFAULT_CATEGORIES.map((c) => c.id));
    expect(categories.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(categories[0]).toMatchObject({ id: 'cat-grocery', icon: '🛒', hidden: false });
    expect(categories[11]).toMatchObject({ id: 'cat-other', name: 'Khác' });
  });
});

describe('createInitialData', () => {
  it('người tạo là admin, người kia là member; tên được cắt khoảng trắng', () => {
    const ids = ['u1', 'u2'];
    const { data, myUserId } = createInitialData({
      deviceId: 'device-1',
      myName: '  An ',
      otherName: 'Bình',
      now: localTime(2026, 10, 23),
      newId: () => ids.shift() ?? 'x',
    });
    expect(myUserId).toBe('u1');
    expect(data.users.map((u) => [u.id, u.name, u.role])).toEqual([
      ['u1', 'An', 'admin'],
      ['u2', 'Bình', 'member'],
    ]);
    expect(data.users[0]?.color).not.toBe(data.users[1]?.color);
    expect(data.schemaVersion).toBe(1);
    expect(data.deviceId).toBe('device-1');
    expect(data.categories).toHaveLength(12);
    expect(data.transactions).toEqual([]);
  });
});
