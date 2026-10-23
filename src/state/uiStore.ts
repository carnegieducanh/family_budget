import { create } from 'zustand';
import { addMonths, toMonth } from '../core/month';

// Trạng thái giao diện (không lưu file): màn hình đang mở, tháng đang chọn, modal khoản chi.

export type Screen =
  | 'overview'
  | 'transactions'
  | 'settlement'
  | 'reports'
  | 'budget'
  | 'categories'
  | 'recurring'
  | 'settings';

export type EditorState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; id: string };

interface UiState {
  screen: Screen;
  /** Tháng đang chọn, dùng chung cho mọi màn hình có bộ chọn tháng. */
  month: string;
  editor: EditorState;

  setScreen(screen: Screen): void;
  setMonth(month: string): void;
  shiftMonth(count: number): void;
  openCreate(): void;
  openEdit(id: string): void;
  closeEditor(): void;
}

export const useUiStore = create<UiState>()((set) => ({
  screen: 'overview',
  month: toMonth(new Date()),
  editor: { mode: 'closed' },

  setScreen: (screen) => set({ screen }),
  setMonth: (month) => set({ month }),
  shiftMonth: (count) => set((s) => ({ month: addMonths(s.month, count) })),
  openCreate: () => set({ editor: { mode: 'create' } }),
  openEdit: (id) => set({ editor: { mode: 'edit', id } }),
  closeEditor: () => set({ editor: { mode: 'closed' } }),
}));
