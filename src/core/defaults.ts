import { SCHEMA_VERSION } from './migrations';
import { createRecord } from './records';
import type { Category, DataFile, Settings, User } from './types';

/** Danh mục mặc định, id cố định để 2 máy không tạo trùng (SPEC mục 4). */
export const DEFAULT_CATEGORIES: ReadonlyArray<{ id: string; icon: string; name: string }> = [
  { id: 'cat-grocery', icon: '🛒', name: 'Siêu thị / Thực phẩm' },
  { id: 'cat-dining', icon: '🍜', name: 'Ăn ngoài' },
  { id: 'cat-rent', icon: '🏠', name: 'Tiền nhà' },
  { id: 'cat-utilities', icon: '💡', name: 'Điện / Nước / Gas' },
  { id: 'cat-telecom', icon: '📶', name: 'Internet / Điện thoại' },
  { id: 'cat-transport', icon: '🚃', name: 'Đi lại' },
  { id: 'cat-household', icon: '🧴', name: 'Đồ dùng gia đình' },
  { id: 'cat-health', icon: '🏥', name: 'Y tế / Thuốc' },
  { id: 'cat-clothing', icon: '👕', name: 'Quần áo' },
  { id: 'cat-leisure', icon: '🎉', name: 'Giải trí / Du lịch' },
  { id: 'cat-gifts', icon: '🎁', name: 'Quà / Hiếu hỉ' },
  { id: 'cat-other', icon: '📦', name: 'Khác' },
];

/** Màu mặc định cho người thứ nhất (admin) và người thứ hai. */
export const USER_COLORS = ['#4F7DF3', '#E8618C'] as const;

export const DEFAULT_SYNC_INTERVAL_MIN = 5;

export function createSettings(deviceId: string): Settings {
  return {
    deviceId,
    userId: null,
    syncFolder: null,
    syncIntervalMin: DEFAULT_SYNC_INTERVAL_MIN,
    encryption: { enabled: false },
  };
}

export function createDefaultCategories(userId: string, now: Date): Category[] {
  return DEFAULT_CATEGORIES.map(({ id, icon, name }, index) =>
    createRecord<Category>(id, { name, icon, order: index + 1, hidden: false }, userId, now),
  );
}

export interface InitialDataInput {
  deviceId: string;
  myName: string;
  otherName: string;
  now: Date;
  newId: () => string;
}

/**
 * Dữ liệu khi admin thiết lập lần đầu: 2 người (người tạo là admin) và danh mục mặc định.
 * Trả về cả userId của người tạo để lưu vào Settings.
 */
export function createInitialData(input: InitialDataInput): { data: DataFile; myUserId: string } {
  const { deviceId, now, newId } = input;
  const myName = input.myName.trim();
  const otherName = input.otherName.trim();

  const myUserId = newId();
  const otherUserId = newId();
  const me = createRecord<User>(
    myUserId,
    { name: myName, role: 'admin', color: USER_COLORS[0] },
    myUserId,
    now,
  );
  const other = createRecord<User>(
    otherUserId,
    { name: otherName, role: 'member', color: USER_COLORS[1] },
    myUserId,
    now,
  );

  const data: DataFile = {
    schemaVersion: SCHEMA_VERSION,
    deviceId,
    writtenAt: now.toISOString(),
    users: [me, other],
    categories: createDefaultCategories(myUserId, now),
    transactions: [],
    budgets: [],
    recurring: [],
    months: [],
  };
  return { data, myUserId };
}
