import {
  ChartColumn,
  Handshake,
  LayoutDashboard,
  Receipt,
  Repeat,
  Tags,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { Screen } from '../state/uiStore';

interface NavItem {
  screen: Screen;
  icon: LucideIcon;
  label: string;
  /** Nhóm trên sidebar: dùng hằng ngày, quản lý. Cài đặt mở từ khối người dùng cuối sidebar. */
  group: 'main' | 'manage';
}

export const NAV_ITEMS: NavItem[] = [
  { screen: 'overview', icon: LayoutDashboard, label: 'Tổng quan', group: 'main' },
  { screen: 'transactions', icon: Receipt, label: 'Khoản chi', group: 'main' },
  { screen: 'settlement', icon: Handshake, label: 'Tất toán', group: 'main' },
  { screen: 'reports', icon: ChartColumn, label: 'Báo cáo', group: 'main' },
  { screen: 'budget', icon: Target, label: 'Ngân sách', group: 'manage' },
  { screen: 'categories', icon: Tags, label: 'Danh mục', group: 'manage' },
  { screen: 'recurring', icon: Repeat, label: 'Định kỳ', group: 'manage' },
];
