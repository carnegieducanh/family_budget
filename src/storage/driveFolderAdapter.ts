import { basename, join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { exists, mkdir, readDir, readTextFile } from '@tauri-apps/plugin-fs';
import {
  SYNC_SUBFOLDER,
  deviceFileName,
  parseDeviceFileName,
  type DeviceFileInfo,
} from '../core/deviceFiles';
import { writeFileAtomic } from './localStore';
import type { SyncAdapter } from './SyncAdapter';

// Sync qua một thư mục Google Drive (app Google Drive for Desktop lo việc đồng bộ thư mục).
// Vị trí thường gặp:
//   Windows: G:\My Drive\...
//   macOS:   ~/Library/CloudStorage/GoogleDrive-<email>/My Drive/...
// Quyền đọc ghi thư mục do người dùng cấp qua hộp chọn thư mục (plugin-dialog) và được
// giữ sau khi mở lại app (plugin-persisted-scope).

/**
 * Thư mục chứa file của các máy: `<syncFolder>/FamilyBudget`. Nếu người dùng chọn thẳng
 * thư mục FamilyBudget (ví dụ lối tắt tới thư mục được chia sẻ) thì dùng luôn thư mục đó.
 */
export async function resolveDataDir(syncFolder: string): Promise<string> {
  const name = await basename(syncFolder);
  return name.toLowerCase() === SYNC_SUBFOLDER.toLowerCase()
    ? syncFolder
    : join(syncFolder, SYNC_SUBFOLDER);
}

/** Mọi file `device-*.json` trong thư mục Drive, kể cả file của máy này. */
export async function listDeviceFiles(syncFolder: string): Promise<DeviceFileInfo[]> {
  const dataDir = await resolveDataDir(syncFolder);
  if (!(await exists(dataDir))) return [];
  return (await readDir(dataDir))
    .filter((entry) => !entry.isDirectory)
    .map((entry) => parseDeviceFileName(entry.name))
    .filter((info): info is DeviceFileInfo => info !== null)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function createDriveFolderAdapter(syncFolder: string, deviceId: string): SyncAdapter {
  let dataDirPromise: Promise<string> | null = null;
  const dataDir = () => (dataDirPromise ??= resolveDataDir(syncFolder));

  return {
    async isReady() {
      // Ổ Drive chưa mount (Google Drive chưa chạy) thì plugin-fs báo lỗi thay vì false.
      try {
        return await exists(syncFolder);
      } catch {
        return false;
      }
    },

    async listRemote() {
      return (await listDeviceFiles(syncFolder))
        .filter((file) => file.deviceId !== deviceId)
        .map(({ name, deviceId: id }) => ({ name, deviceId: id }));
    },

    async readRemote(name) {
      return readTextFile(await join(await dataDir(), name));
    },

    async writeOwn(content) {
      const dir = await dataDir();
      await mkdir(dir, { recursive: true });
      await writeFileAtomic(dir, deviceFileName(deviceId), content);
    },
  };
}

/**
 * Hộp chọn thư mục Drive; null nếu người dùng bấm hủy. Thư mục được chọn (kể cả thư mục
 * con) được cấp quyền đọc ghi cho app.
 */
export async function pickSyncFolder(defaultPath?: string | null): Promise<string | null> {
  const selected = await open({
    directory: true,
    recursive: true,
    title: 'Chọn thư mục Google Drive để đồng bộ',
    ...(defaultPath ? { defaultPath } : {}),
  });
  return typeof selected === 'string' ? selected : null;
}
