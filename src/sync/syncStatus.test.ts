import { describe, expect, it } from 'vitest';
import { localTime } from '../core/testing';
import { describeSyncStatus, formatSyncTime } from './syncStatus';
import type { SyncOutcome } from './syncService';

const NOW = localTime(2026, 10, 23, 14, 30);
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function ok(patch: Partial<Extract<SyncOutcome, { kind: 'ok' }>> = {}): SyncOutcome {
  return {
    kind: 'ok',
    at: localTime(2026, 10, 23, 14, 5).toISOString(),
    changed: false,
    remotes: [{ name: 'device-b.json', deviceId: 'b', writtenAt: minutesAgo(3) }],
    problems: [],
    clockSkew: false,
    ...patch,
  };
}

function view(last: SyncOutcome | null, lastSuccessAt: string | null = null, running = false) {
  return describeSyncStatus({ running, last, lastSuccessAt }, NOW);
}

describe('describeSyncStatus', () => {
  it('đã sync', () => {
    expect(view(ok(), minutesAgo(25))).toEqual({
      main: { text: 'Đã sync lúc 14:05', tone: 'ok' },
      extra: [],
    });
  });

  it('đang sync', () => {
    expect(view(ok(), minutesAgo(25), true).main).toEqual({
      text: 'Đang sync...',
      tone: 'busy',
    });
  });

  it('chưa thấy dữ liệu từ máy kia', () => {
    const status = view(ok({ remotes: [] }), minutesAgo(25));
    expect(status.main.text).toBe('Chưa thấy dữ liệu từ máy kia');
    expect(status.extra[0]?.text).toBe('Đã sync lúc 14:05');
  });

  it('chưa kết nối thư mục Drive', () => {
    expect(view({ kind: 'not-configured' }).main.text).toBe('Chưa kết nối thư mục Drive');
  });

  it('lỗi không tìm thấy thư mục, kèm lần sync thành công cuối', () => {
    const status = view({ kind: 'folder-missing' }, minutesAgo(125));
    expect(status.main).toEqual({ text: 'Lỗi: không tìm thấy thư mục Drive', tone: 'error' });
    expect(status.extra).toEqual([
      { text: 'Lần sync thành công cuối: 2 giờ trước', tone: 'warning' },
    ]);
  });

  it('lần sync thành công cuối trong vòng 1 giờ thì không cảnh báo', () => {
    const status = view({ kind: 'failed', message: 'mất mạng' }, minutesAgo(40));
    expect(status.main).toEqual({ text: 'Lỗi: mất mạng', tone: 'error' });
    expect(status.extra).toEqual([
      { text: 'Lần sync thành công cuối: 40 phút trước', tone: 'muted' },
    ]);
  });

  it('máy kia dùng bản mới hơn', () => {
    expect(view({ kind: 'schema-too-new', version: 2 }).main).toEqual({
      text: 'Máy kia đang dùng bản mới hơn, hãy cập nhật app',
      tone: 'error',
    });
  });

  it('file lỗi và lệch giờ là cảnh báo nhẹ', () => {
    const problem = { name: 'device-b.json', reason: 'invalid' as const, message: 'hỏng' };
    const status = view(ok({ problems: [problem], clockSkew: true }), minutesAgo(25));
    expect(status.main.tone).toBe('ok');
    expect(status.extra).toEqual([
      { text: 'Bỏ qua 1 file lỗi, xem Cài đặt', tone: 'warning' },
      { text: 'Giờ trên hai máy lệch nhau', tone: 'warning' },
    ]);
  });

  it('lần sync thành công đã quá 1 giờ (máy ngủ) → cảnh báo', () => {
    const at = minutesAgo(180);
    expect(view(ok({ at }), at).main).toEqual({
      text: 'Lần sync thành công cuối: 3 giờ trước',
      tone: 'warning',
    });
  });

  it('mới mở app, chưa sync lượt nào', () => {
    expect(view(null).main.text).toBe('Chưa sync');
    expect(view(null, minutesAgo(10)).main.text).toBe('Lần sync thành công cuối: 10 phút trước');
  });
});

describe('formatSyncTime', () => {
  it('cùng ngày chỉ hiện giờ, khác ngày hiện cả ngày', () => {
    expect(formatSyncTime(localTime(2026, 10, 23, 9, 7).toISOString(), NOW)).toBe('09:07');
    expect(formatSyncTime(localTime(2026, 10, 22, 23, 50).toISOString(), NOW)).toBe(
      '23:50 22/10/2026',
    );
  });
});
