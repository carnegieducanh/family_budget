import { create } from 'zustand';

// Trạng thái cập nhật app để hiển thị (popup cập nhật và Cài đặt). Không lưu file.

export interface AvailableUpdate {
  version: string;
  /** Ghi chú thay đổi của bản mới (từ docs/CHANGELOG.md khi phát hành). */
  notes: string;
}

export type InstallState =
  | { phase: 'idle' }
  | { phase: 'downloading'; downloaded: number; total: number | null }
  | { phase: 'installing' }
  | { phase: 'failed'; message: string };

interface UpdateState {
  /** Phiên bản đang chạy. */
  currentVersion: string | null;
  checking: boolean;
  /** Bản mới tìm thấy ở lần kiểm tra gần nhất; null nếu đang dùng bản mới nhất. */
  available: AvailableUpdate | null;
  /** Kết quả lần kiểm tra gần nhất; null khi chưa kiểm tra lần nào. */
  lastCheck: { at: string; error: string | null } | null;
  install: InstallState;
  /** Người dùng bấm "Để sau" cho bản này: ẩn popup đến lần mở app sau. */
  dismissedVersion: string | null;
}

export const useUpdateStore = create<UpdateState>()(() => ({
  currentVersion: null,
  checking: false,
  available: null,
  lastCheck: null,
  install: { phase: 'idle' },
  dismissedVersion: null,
}));
