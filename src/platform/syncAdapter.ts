import type { Settings } from '../core/types';
import { createDriveFolderAdapter } from '../storage/driveFolderAdapter';
import type { SyncAdapter } from '../storage/SyncAdapter';
import { LOCAL_CHANGE_DELAY_MS } from '../sync/syncService';

// Nơi các máy trao đổi file dữ liệu. App desktop: thư mục Google Drive trên máy
// (`settings.syncFolder` là đường dẫn thư mục). Bản web dùng syncAdapter.web.ts.

/** Nơi sync theo cài đặt của máy này; null khi chưa kết nối. `encrypted`: ghi file mã hóa. */
export function createSyncAdapter(settings: Settings, encrypted: boolean): SyncAdapter | null {
  if (!settings.syncFolder) return null;
  return createDriveFolderAdapter(settings.syncFolder, settings.deviceId, encrypted);
}

/** Sau thay đổi local, ghi file lên Drive khi đã 10 giây không có thay đổi mới (SPEC mục 5). */
export const SYNC_AFTER_CHANGE_MS = LOCAL_CHANGE_DELAY_MS;
