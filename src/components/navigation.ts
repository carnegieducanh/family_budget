import { can, type Action } from '../core/permissions';
import type { User } from '../core/types';
import type { Screen } from '../state/uiStore';

interface NavItem {
  screen: Screen;
  icon: string;
  label: string;
  /** Màn hình quản lý chỉ admin dùng (SPEC mục 7, 8); ẩn với người dùng thường. */
  action?: Action;
}

export const NAV_ITEMS: NavItem[] = [
  { screen: 'overview', icon: '📊', label: 'Tổng quan' },
  { screen: 'transactions', icon: '🧾', label: 'Khoản chi' },
  { screen: 'settlement', icon: '🤝', label: 'Tất toán' },
  { screen: 'reports', icon: '📈', label: 'Báo cáo' },
  { screen: 'budget', icon: '🎯', label: 'Ngân sách', action: 'budgets:manage' },
  { screen: 'categories', icon: '🗂️', label: 'Danh mục', action: 'categories:manage' },
  { screen: 'recurring', icon: '🔁', label: 'Định kỳ', action: 'recurring:manage' },
  { screen: 'settings', icon: '⚙️', label: 'Cài đặt' },
];

/** Màn hình người dùng này được mở. */
export function canOpen(user: User, screen: Screen): boolean {
  const item = NAV_ITEMS.find((i) => i.screen === screen);
  return !item?.action || can(user, item.action);
}
