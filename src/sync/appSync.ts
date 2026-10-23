import { getCurrentWindow } from '@tauri-apps/api/window';
import { DEFAULT_SYNC_INTERVAL_MIN } from '../core/defaults';
import type { DeviceFileInfo } from '../core/deviceFiles';
import type { RemoteFile } from '../core/sync';
import { useDataStore } from '../state/dataStore';
import { useSyncStore } from '../state/syncStore';
import { createSnapshot } from '../storage/backup';
import {
  createDriveFolderAdapter,
  listDeviceFiles,
  resolveDataDir,
} from '../storage/driveFolderAdapter';
import {
  createSyncScheduler,
  readRemoteFiles,
  syncOnce,
  type SyncEnv,
  type SyncOutcome,
  type SyncScheduler,
} from './syncService';

// Nối syncService với store và thư mục Drive. Chạy một lần khi dữ liệu đã sẵn sàng.

const env: SyncEnv = {
  adapter() {
    const { settings } = useDataStore.getState();
    return settings?.syncFolder
      ? createDriveFolderAdapter(settings.syncFolder, settings.deviceId)
      : null;
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
  /** Nội dung các file của máy khác. */
  remoteFiles: RemoteFile[];
}

/** Đọc thư mục Drive vừa chọn, để kiểm tra trước khi tạo mới, tham gia hoặc kết nối. */
export async function inspectFolder(folder: string, deviceId: string): Promise<FolderContents> {
  const dataDir = await resolveDataDir(folder);
  const deviceFiles = await listDeviceFiles(folder);
  const remoteFiles = await readRemoteFiles(createDriveFolderAdapter(folder, deviceId));
  return { folder, dataDir, deviceFiles, remoteFiles };
}
