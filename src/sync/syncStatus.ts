import dayjs from 'dayjs';
import { formatTimeAgo } from '../core/month';
import type { SyncOutcome } from './syncService';

// Chữ hiển thị trạng thái sync ở góc sidebar và trong Cài đặt (SPEC mục 5).

export type SyncTone = 'ok' | 'busy' | 'muted' | 'warning' | 'error';

export interface StatusLine {
  text: string;
  tone: SyncTone;
}

export interface SyncStatusView {
  main: StatusLine;
  extra: StatusLine[];
}

export interface SyncStatusInput {
  running: boolean;
  last: SyncOutcome | null;
  lastSuccessAt: string | null;
}

/** Lần sync thành công cuối cũ hơn 1 giờ thì đổi màu cảnh báo. */
export const STALE_AFTER_MS = 60 * 60 * 1000;

/** "14:05" nếu cùng ngày, "14:05 22/10/2026" nếu khác ngày. */
export function formatSyncTime(iso: string, now: Date): string {
  const time = dayjs(iso);
  return time.isSame(now, 'day') ? time.format('HH:mm') : time.format('HH:mm DD/MM/YYYY');
}

export function describeSyncStatus(input: SyncStatusInput, now: Date): SyncStatusView {
  const { running, last, lastSuccessAt } = input;
  const stale =
    lastSuccessAt !== null && now.getTime() - Date.parse(lastSuccessAt) > STALE_AFTER_MS;
  const lastSuccess: StatusLine[] = lastSuccessAt
    ? [
        {
          text: `Lần sync thành công cuối: ${formatTimeAgo(lastSuccessAt, now)}`,
          tone: stale ? 'warning' : 'muted',
        },
      ]
    : [];

  if (running) return { main: { text: 'Đang sync...', tone: 'busy' }, extra: [] };

  if (!last) {
    return lastSuccessAt
      ? { main: lastSuccess[0] as StatusLine, extra: [] }
      : { main: { text: 'Chưa sync', tone: 'muted' }, extra: [] };
  }

  switch (last.kind) {
    case 'not-configured':
      return { main: { text: 'Chưa kết nối thư mục Drive', tone: 'muted' }, extra: [] };
    case 'folder-missing':
      return {
        main: { text: 'Lỗi: không tìm thấy thư mục Drive', tone: 'error' },
        extra: lastSuccess,
      };
    case 'schema-too-new':
      return {
        main: { text: 'Máy kia đang dùng bản mới hơn, hãy cập nhật app', tone: 'error' },
        extra: lastSuccess,
      };
    case 'failed':
      return { main: { text: `Lỗi: ${last.message}`, tone: 'error' }, extra: lastSuccess };
    case 'ok': {
      const extra: StatusLine[] = [];
      if (last.problems.length > 0) {
        extra.push({
          text: `Bỏ qua ${last.problems.length} file lỗi, xem Cài đặt`,
          tone: 'warning',
        });
      }
      if (last.clockSkew) extra.push({ text: 'Giờ trên hai máy lệch nhau', tone: 'warning' });

      // Máy ngủ lâu nên chưa tới lượt sync định kỳ: báo đã lâu chưa sync.
      if (stale) return { main: lastSuccess[0] as StatusLine, extra };

      const synced: StatusLine = {
        text: `Đã sync lúc ${formatSyncTime(last.at, now)}`,
        tone: 'ok',
      };
      if (last.remotes.length === 0) {
        return {
          main: { text: 'Chưa thấy dữ liệu từ máy kia', tone: 'muted' },
          extra: [{ ...synced, tone: 'muted' }, ...extra],
        };
      }
      return { main: synced, extra };
    }
  }
}
