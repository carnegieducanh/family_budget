import {
  ChartColumn,
  Handshake,
  LayoutDashboard,
  Receipt,
  Repeat,
  Settings,
  Tags,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { can, type Action } from '../core/permissions';
import type { User } from '../core/types';
import type { Screen } from '../state/uiStore';

interface NavItem {
  screen: Screen;
  icon: LucideIcon;
  label: string;
  /** Nhóm trên sidebar: dùng hằng ngày, quản lý (admin), hệ thống (dưới cùng). */
  group: 'main' | 'manage' | 'system';
  /** Màn hình quản lý chỉ admin dùng (SPEC mục 7, 8); ẩn với người dùng thường. */
  action?: Action;
}

export const NAV_ITEMS: NavItem[] = [
  { screen: 'overview', icon: LayoutDashboard, label: 'Tổng quan', group: 'main' },
  { screen: 'transactions', icon: Receipt, label: 'Khoản chi', group: 'main' },
  { screen: 'settlement', icon: Handshake, label: 'Tất toán', group: 'main' },
  { screen: 'reports', icon: ChartColumn, label: 'Báo cáo', group: 'main' },
  {
    screen: 'budget',
    icon: Target,
    label: 'Ngân sách',
    group: 'manage',
    action: 'budgets:manage',
  },
  {
    screen: 'categories',
    icon: Tags,
    label: 'Danh mục',
    group: 'manage',
    action: 'categories:manage',
  },
  {
    screen: 'recurring',
    icon: Repeat,
    label: 'Định kỳ',
    group: 'manage',
    action: 'recurring:manage',
  },
  { screen: 'settings', icon: Settings, label: 'Cài đặt', group: 'system' },
];

/** Màn hình người dùng này được mở. */
export function canOpen(user: User, screen: Screen): boolean {
  const item = NAV_ITEMS.find((i) => i.screen === screen);
  return !item?.action || can(user, item.action);
}
