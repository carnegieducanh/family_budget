import { create } from 'zustand';
import type { SyncOutcome } from '../sync/syncService';

// Trạng thái sync để hiển thị (không lưu file, trừ lastSyncAt nằm trong settings.json).

interface SyncState {
  running: boolean;
  /** Kết quả lượt sync gần nhất; null khi chưa chạy lượt nào từ lúc mở app. */
  last: SyncOutcome | null;
  /** Thời điểm sync thành công gần nhất, kể cả từ lần mở app trước. */
  lastSuccessAt: string | null;

  started(): void;
  finished(outcome: SyncOutcome): void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  running: false,
  last: null,
  lastSuccessAt: null,

  started: () => set({ running: true }),
  finished: (outcome) =>
    set((s) => ({
      running: false,
      last: outcome,
      lastSuccessAt: outcome.kind === 'ok' ? outcome.at : s.lastSuccessAt,
    })),
}));
