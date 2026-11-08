import type { SyncAdapter } from '../storage/SyncAdapter';

// Bản web của syncAdapter.ts. Chưa có cách kết nối Drive từ trình duyệt (bước 2: Google Apps
// Script), nên máy web chưa bao giờ có `syncFolder` và hàm này chưa được gọi.
export function createSyncAdapter(
  syncFolder: string,
  deviceId: string,
  encrypted = false,
): SyncAdapter {
  void [syncFolder, deviceId, encrypted];
  throw new Error('Bản web chưa kết nối được với Google Drive.');
}
