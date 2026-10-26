import dayjs from 'dayjs';
import { formatTimeAgo } from '../core/month';
import type { RemoteInfo } from '../core/sync';
import type { User } from '../core/types';
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
      const reasons = last.problems.map((p) => p.reason);
      // Lỗi mã hóa cần người dùng nhập mật khẩu nên có dòng riêng; banner ở App nói chi tiết.
      if (reasons.includes('encrypted')) {
        extra.push({ text: 'Máy kia đã mã hóa dữ liệu, cần nhập mật khẩu', tone: 'warning' });
      }
      if (reasons.includes('decrypt-failed')) {
        extra.push({ text: 'Không giải mã được dữ liệu từ máy kia', tone: 'warning' });
      }
      const others = reasons.filter((r) => r !== 'encrypted' && r !== 'decrypt-failed').length;
      if (others > 0) {
        extra.push({ text: `Bỏ qua ${others} file lỗi, xem Cài đặt`, tone: 'warning' });
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

/**
 * Tên một máy khác trong Cài đặt: "Máy <tên người dùng>" theo người dùng máy đó ghi trong file.
 * File của bản app cũ chưa ghi người dùng thì dùng 8 ký tự đầu của mã máy. Có hai máy của cùng
 * một người (cài lại app, thêm máy) thì thêm mã máy để phân biệt.
 */
export function remoteDeviceName(
  remote: RemoteInfo,
  users: readonly User[],
  remotes: readonly RemoteInfo[],
): string {
  const shortId = remote.deviceId.slice(0, 8);
  const user = users.find((u) => u.id === remote.writtenBy);
  if (!user) return `Máy ${shortId}`;
  const sameUser = remotes.filter((r) => r.writtenBy === remote.writtenBy).length > 1;
  return sameUser ? `Máy ${user.name} (${shortId})` : `Máy ${user.name}`;
}
