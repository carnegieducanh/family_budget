import { getCurrentWindow } from '@tauri-apps/api/window';
import { DEFAULT_SYNC_INTERVAL_MIN } from '../core/defaults';
import { parseDeviceFileName, type DeviceFileInfo } from '../core/deviceFiles';
import { connectProblem } from '../core/sync';
import type { Settings } from '../core/types';
import { useDataStore } from '../state/dataStore';
import { useSyncStore } from '../state/syncStore';
import { createSnapshot } from '../storage/backup';
import { importFileKey, type FileKey } from '../storage/crypto';
import {
  createDriveFolderAdapter,
  listDeviceFiles,
  resolveDataDir,
} from '../storage/driveFolderAdapter';
import {
  createSyncScheduler,
  openRemoteFiles,
  readRemoteFiles,
  syncOnce,
  type RawRemoteFile,
  type SyncEnv,
  type SyncOutcome,
  type SyncScheduler,
} from './syncService';

// Nối syncService với store và thư mục Drive. Chạy một lần khi dữ liệu đã sẵn sàng.

let cachedKey: { id: string; key: Promise<FileKey> } | null = null;

/** Khóa mã hóa lưu trong settings.json của máy này; null nếu máy chưa có mật khẩu. */
export function settingsKey(settings: Settings | null): Promise<FileKey | null> {
  const { keyB64, saltB64 } = settings?.encryption ?? {};
  if (!keyB64 || !saltB64) return Promise.resolve(null);
  const id = `${saltB64}:${keyB64}`;
  if (cachedKey?.id !== id) cachedKey = { id, key: importFileKey({ keyB64, saltB64 }) };
  return cachedKey.key;
}

const env: SyncEnv = {
  async target() {
    // Thư mục, khóa và chế độ ghi lấy từ cùng một bản settings, để tên file luôn khớp nội dung.
    const { settings } = useDataStore.getState();
    if (!settings?.syncFolder) return null;
    const readKey = await settingsKey(settings);
    const writeKey = settings.encryption.enabled ? readKey : null;
    return {
      adapter: createDriveFolderAdapter(settings.syncFolder, settings.deviceId, writeKey !== null),
      readKey,
      writeKey,
      writtenBy: settings.userId,
    };
  },
  getData() {
    const { data } = useDataStore.getState();
    if (!data) throw new Error('Chưa có dữ liệu.');
    return data;
  },
  async backup(data) {
    await createSnapshot(data);
  },
  applyMerged: (data) => useDataStore.getState().applyMerged(data),
  now: () => new Date(),
};

let scheduler: SyncScheduler | null = null;
const cleanups: Array<() => void> = [];

function onFinish(outcome: SyncOutcome): void {
  useSyncStore.getState().finished(outcome);
  // Sau mỗi lượt sync: sinh khoản định kỳ (SPEC mục 6), kể cả khi vừa sang tháng mới.
  useDataStore.getState().generateRecurring();
  if (outcome.kind === 'ok') {
    useDataStore
      .getState()
      .updateSettings({ lastSyncAt: outcome.at })
      .catch((error: unknown) => console.warn('Không lưu được lastSyncAt:', error));
  }
}

/** Nội dung các file mã hóa của máy khác trong thư mục, để kiểm tra mật khẩu nhập vào. */
export function encryptedContents(files: readonly RawRemoteFile[]): string[] {
  return files.flatMap((file) =>
    'content' in file && parseDeviceFileName(file.name)?.encrypted ? [file.content] : [],
  );
}

/** Bắt đầu lịch sync: sync ngay khi mở app, định kỳ, khi focus lại, sau thay đổi local. */
export function startSync(): SyncScheduler {
  if (scheduler) return scheduler;
  const { settings } = useDataStore.getState();
  useSyncStore.setState({ lastSuccessAt: settings?.lastSyncAt ?? null });

  const current = createSyncScheduler(() => syncOnce(env), {
    onStart: () => useSyncStore.getState().started(),
    onFinish,
  });
  scheduler = current;
  current.setIntervalMinutes(settings?.syncIntervalMin ?? DEFAULT_SYNC_INTERVAL_MIN);

  cleanups.push(
    useDataStore.subscribe((state, prev) => {
      if (state.localRevision !== prev.localRevision) current.notifyLocalChange();
      const interval = state.settings?.syncIntervalMin;
      if (interval && interval !== prev.settings?.syncIntervalMin) {
        current.setIntervalMinutes(interval);
      }
    }),
  );

  getCurrentWindow()
    .onFocusChanged(({ payload: focused }) => {
      if (focused) current.notifyFocus();
    })
    .then(
      (unlisten) => cleanups.push(unlisten),
      (error: unknown) => console.warn('Không theo dõi được focus cửa sổ:', error),
    );

  void current.request();
  return current;
}

/** Nút "Sync ngay", hoặc sau khi đổi thư mục Drive. */
export function syncNow(): Promise<SyncOutcome> {
  return startSync().request();
}

function stopSync(): void {
  scheduler?.stop();
  scheduler = null;
  cleanups.splice(0).forEach((cleanup) => cleanup());
}

// Khi dev sửa code (HMR), dừng lịch sync cũ để không có 2 lịch chạy song song.
import.meta.hot?.dispose(stopSync);

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
