import type { DeviceFileInfo } from '../core/deviceFiles';
import { connectProblem } from '../core/sync';
import { useDataStore } from '../state/dataStore';
import {
  createDriveFolderAdapter,
  listDeviceFiles,
  resolveDataDir,
} from '../storage/driveFolderAdapter';
import { settingsKey, syncNow } from './appSync';
import { openRemoteFiles, readRemoteFiles, type RawRemoteFile } from './syncService';

// Kết nối thư mục Google Drive trên máy (chỉ có ở app desktop): thiết lập lần đầu, Cài đặt
// → Sync, nhập mật khẩu mã hóa.

export interface FolderContents {
  folder: string;
  /** Thư mục chứa file các máy (`<folder>/FamilyBudget`). */
  dataDir: string;
  /** Mọi file `device-*.json`, kể cả của máy này. */
  deviceFiles: DeviceFileInfo[];
  /** Nội dung thô các file của máy khác; file `.enc.json` chưa giải mã. */
  rawFiles: RawRemoteFile[];
}

/**
 * Đọc thư mục Drive vừa chọn, để kiểm tra trước khi tạo mới, tham gia hoặc kết nối; cũng
 * dùng để lấy file mã hóa của máy kia khi nhập mật khẩu chung.
 */
export async function inspectFolder(folder: string, deviceId: string): Promise<FolderContents> {
  const dataDir = await resolveDataDir(folder);
  const deviceFiles = await listDeviceFiles(folder);
  const rawFiles = await readRemoteFiles(createDriveFolderAdapter(folder, deviceId));
  return { folder, dataDir, deviceFiles, rawFiles };
}

/**
 * Kết nối thư mục Drive vừa chọn rồi sync ngay (Cài đặt, hoặc bấm "Chưa kết nối thư mục Drive"
 * ở sidebar). Ném lỗi kèm lý do nếu thư mục chứa dữ liệu của gia đình khác.
 */
export async function connectSyncFolder(folder: string): Promise<void> {
  const { settings, data } = useDataStore.getState();
  if (!settings) throw new Error('Chưa đọc được settings.');
  const contents = await inspectFolder(folder, settings.deviceId);
  const files = await openRemoteFiles(contents.rawFiles, await settingsKey(settings));
  const problem = data && connectProblem(data, files, new Date());
  if (problem) throw new Error(problem);
  await useDataStore.getState().updateSettings({ syncFolder: folder });
  void syncNow();
}
