import type { Settings } from '../core/types';
import { idbGet, idbSet } from '../storage/idb';
import { createScriptAdapter, type RemoteFileCache } from '../storage/scriptAdapter';
import type { SyncAdapter } from '../storage/SyncAdapter';

// Bản web của syncAdapter.ts: sync qua Google Apps Script (storage/scriptAdapter.ts).
// `settings.syncFolder` là URL ứng dụng web của script, `settings.syncKey` là mã kết nối.

/**
 * Bản sao file của các máy khác trong IndexedDB, giữ qua các lần mở app: script chỉ gửi lại file
 * đã sửa kể từ lần tải trước. Hỏng hoặc mất thì script gửi đủ ở lượt sau.
 */
const REMOTE_CACHE = 'remote-files.json';
const remoteFileCache: RemoteFileCache = {
  async load() {
    const json = await idbGet(REMOTE_CACHE);
    return json === null ? null : JSON.parse(json);
  },
  save: (files) => idbSet(REMOTE_CACHE, JSON.stringify(files)),
};

/** Nơi sync theo cài đặt của máy này; null khi chưa kết nối. Bản web không ghi file mã hóa. */
export function createSyncAdapter(settings: Settings, encrypted: boolean): SyncAdapter | null {
  void encrypted;
  if (!settings.syncFolder || !settings.syncKey) return null;
  return createScriptAdapter(
    { url: settings.syncFolder, key: settings.syncKey },
    settings.deviceId,
    { cache: remoteFileCache },
  );
}

/**
 * Điện thoại hay bị đóng app ngay sau khi lưu: ghi file lên Drive sau 2 giây thay vì 10 giây,
 * để khoản vừa nhập kịp lên Drive trong lúc người dùng còn nhìn màn hình.
 */
export const SYNC_AFTER_CHANGE_MS = 2_000;
