import { invoke } from '@tauri-apps/api/core';
import { basename, join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { exists, mkdir, readDir, readTextFile, remove } from '@tauri-apps/plugin-fs';
import {
  SYNC_SUBFOLDER,
  deviceFileName,
  holdsDeviceFiles,
  isSyncSubfolderName,
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
 * Thư mục chứa file của các máy: `<syncFolder>/FamilyBudget`. Dùng luôn thư mục đã chọn khi
 * người dùng chọn thẳng thư mục FamilyBudget (ví dụ lối tắt tới thư mục được chia sẻ), hoặc
 * một thư mục đã chứa sẵn file của các máy, như "FamilyBudget (1)" (`holdsDeviceFiles`).
 * Lỗi đọc thư mục thì ném ra, không đoán thư mục con, để không ghi nhầm chỗ.
 */
export async function resolveDataDir(syncFolder: string): Promise<string> {
  if (isSyncSubfolderName(await basename(syncFolder))) return syncFolder;
  const nested = await join(syncFolder, SYNC_SUBFOLDER);
  // Thư mục chưa có (Drive đổi tên, xóa...): chỉ để hiện đường dẫn, lượt sync báo thiếu thư mục.
  if (!(await exists(syncFolder))) return nested;
  return holdsDeviceFiles(await readDir(syncFolder)) ? syncFolder : nested;
}

/** Mọi file `device-*.json` trong thư mục Drive, kể cả file của máy này. */
export async function listDeviceFiles(syncFolder: string): Promise<DeviceFileInfo[]> {
  return listDeviceFilesIn(await resolveDataDir(syncFolder));
}

async function listDeviceFilesIn(dataDir: string): Promise<DeviceFileInfo[]> {
  if (!(await exists(dataDir))) return [];
  return (await readDir(dataDir))
    .filter((entry) => !entry.isDirectory)
    .map((entry) => parseDeviceFileName(entry.name))
    .filter((info): info is DeviceFileInfo => info !== null)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * `encrypted`: file của máy này là `device-<id>.enc.json` (nội dung đã mã hóa) thay cho
 * `device-<id>.json`. Sau khi ghi, bản kia của chính máy này bị xóa, để file dạng thường
 * không còn nằm lại trên Drive sau khi bật mã hóa, và máy kia không đọc nhầm bản cũ.
 */
export function createDriveFolderAdapter(
  syncFolder: string,
  deviceId: string,
  encrypted = false,
): SyncAdapter {
  // Một adapter dùng cho một lượt sync: đọc và ghi trong cùng một thư mục, kể cả khi thư mục
  // thay đổi giữa chừng. Lỗi thì lần sau tìm lại.
  let dataDirPromise: Promise<string> | null = null;
  const dataDir = () =>
    (dataDirPromise ??= resolveDataDir(syncFolder).catch((error: unknown) => {
      dataDirPromise = null;
      throw error;
    }));

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
      return (await listDeviceFilesIn(await dataDir()))
        .filter((file) => file.deviceId !== deviceId)
        .map(({ name, deviceId: id }) => ({ name, deviceId: id }));
    },

    async readRemote(name) {
      return readTextFile(await join(await dataDir(), name));
    },

    async writeOwn(content) {
      const dir = await dataDir();
      await mkdir(dir, { recursive: true });
      await writeFileAtomic(dir, deviceFileName(deviceId, encrypted), content);
      // Nội dung bản kia đã có đủ trong file vừa ghi và trong data.json trên máy.
      const other = await join(dir, deviceFileName(deviceId, !encrypted));
      if (await exists(other)) await remove(other);
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

/** Tìm Google Drive quá lâu (ổ mạng treo...) thì thôi, người dùng tự chọn thư mục. */
const FIND_TIMEOUT_MS = 8000;

/**
 * Các thư mục FamilyBudget đã có dữ liệu trong Google Drive for Desktop của máy này (lệnh
 * Rust `find_sync_folders`), đã được cấp quyền đọc ghi. Rỗng nếu không tìm thấy hoặc lỗi.
 */
export async function findSyncFolders(): Promise<string[]> {
  const timeout = new Promise<string[]>((resolve) =>
    setTimeout(() => resolve([]), FIND_TIMEOUT_MS),
  );
  return Promise.race([invoke<string[]>('find_sync_folders'), timeout]).catch(() => []);
}
