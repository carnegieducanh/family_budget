import {
  parseDataFile,
  parseSettings,
  serializeDataFile,
  serializeSettings,
} from '../core/dataFile';
import { createSettings } from '../core/defaults';
import type { DataFile, Settings } from '../core/types';
import { idbGet, idbSet, requestPersistentStorage } from './idb';

// Bản web của localStore.ts: data.json và settings.json nằm trong IndexedDB của trình duyệt
// (storage/idb.ts) thay cho thư mục app data. Cùng định dạng JSON, cùng cách kiểm tra khi đọc.

const DATA_FILE = 'data.json';
const SETTINGS_FILE = 'settings.json';

// Mọi lần ghi đi qua một hàng đợi để lần ghi sau luôn kết thúc sau lần ghi trước.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task);
  writeQueue = run.catch(() => undefined);
  return run;
}

/** Chờ các lần ghi đang xếp hàng xong. */
export async function flushWrites(): Promise<void> {
  let queue: Promise<unknown>;
  do {
    queue = writeQueue;
    await queue;
  } while (queue !== writeQueue);
}

/** Đọc settings; lần mở đầu tiên thì tạo mới với deviceId ngẫu nhiên. */
export async function loadSettings(): Promise<Settings> {
  requestPersistentStorage();
  const json = await idbGet(SETTINGS_FILE);
  if (json !== null) return parseSettings(json);
  const settings = createSettings(crypto.randomUUID());
  await saveSettings(settings);
  return settings;
}

export function saveSettings(settings: Settings): Promise<void> {
  return enqueue(() => idbSet(SETTINGS_FILE, serializeSettings(settings)));
}

/** Đọc dữ liệu; null nếu chưa có. Ném lỗi nếu dữ liệu hỏng — không bao giờ tự ghi đè. */
export async function loadData(): Promise<DataFile | null> {
  const json = await idbGet(DATA_FILE);
  return json === null ? null : parseDataFile(json);
}

export function saveData(data: DataFile): Promise<void> {
  return enqueue(() =>
    idbSet(DATA_FILE, serializeDataFile({ ...data, writtenAt: new Date().toISOString() })),
  );
}
