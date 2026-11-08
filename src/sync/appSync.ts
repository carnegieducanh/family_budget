import { DEFAULT_SYNC_INTERVAL_MIN } from '../core/defaults';
import { parseDeviceFileName } from '../core/deviceFiles';
import type { Settings } from '../core/types';
import { onWindowFocus } from '../platform/nativeWindow';
import { SYNC_AFTER_CHANGE_MS, createSyncAdapter } from '../platform/syncAdapter';
import { useDataStore } from '../state/dataStore';
import { useSyncStore } from '../state/syncStore';
import { createSnapshot } from '../storage/backup';
import { importFileKey, type FileKey } from '../storage/crypto';
import {
  createSyncScheduler,
  syncOnce,
  type RawRemoteFile,
  type LastWrite,
  type SyncEnv,
  type SyncOutcome,
  type SyncScheduler,
} from './syncService';

// Nối syncService với store và nơi sync (thư mục Drive trên desktop). Chạy một lần khi dữ
// liệu đã sẵn sàng. Kết nối thư mục Drive (chỉ có trên desktop) nằm ở driveFolderConnect.ts.

let cachedKey: { id: string; key: Promise<FileKey> } | null = null;

/** Khóa mã hóa lưu trong settings.json của máy này; null nếu máy chưa có mật khẩu. */
export function settingsKey(settings: Settings | null): Promise<FileKey | null> {
  const { keyB64, saltB64 } = settings?.encryption ?? {};
  if (!keyB64 || !saltB64) return Promise.resolve(null);
  const id = `${saltB64}:${keyB64}`;
  if (cachedKey?.id !== id) cachedKey = { id, key: importFileKey({ keyB64, saltB64 }) };
  return cachedKey.key;
}

/** Lần ghi file của máy này gần nhất trong lần mở app này (mở lại app thì lượt đầu luôn ghi). */
let lastWrite: LastWrite | null = null;

const env: SyncEnv = {
  async target() {
    // Thư mục, khóa và chế độ ghi lấy từ cùng một bản settings, để tên file luôn khớp nội dung.
    const { settings } = useDataStore.getState();
    if (!settings?.syncFolder) return null;
    const readKey = await settingsKey(settings);
    const writeKey = settings.encryption.enabled ? readKey : null;
    const adapter = createSyncAdapter(settings, writeKey !== null);
    if (!adapter) return null;
    return {
      adapter,
      readKey,
      writeKey,
      writtenBy: settings.userId,
      location: settings.syncFolder,
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
  lastWrite: {
    get: () => lastWrite,
    set: (value) => {
      lastWrite = value;
    },
  },
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

  const current = createSyncScheduler(
    () => syncOnce(env),
    { onStart: () => useSyncStore.getState().started(), onFinish },
    SYNC_AFTER_CHANGE_MS,
  );
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

  onWindowFocus(() => current.notifyFocus()).then(
    (unlisten) => cleanups.push(unlisten),
    (error: unknown) => console.warn('Không theo dõi được focus cửa sổ:', error),
  );

  // Rời app (chuyển sang app khác, khóa màn hình điện thoại, thu nhỏ cửa sổ) khi thay đổi vừa
  // nhập chưa lên Drive: ghi ngay, không chờ hết thời gian debounce.
  const onHidden = () => {
    if (document.visibilityState === 'hidden') current.flushLocalChange();
  };
  document.addEventListener('visibilitychange', onHidden);
  cleanups.push(() => document.removeEventListener('visibilitychange', onHidden));

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
