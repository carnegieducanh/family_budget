import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import {
  parseDataFile,
  parseSettings,
  serializeDataFile,
  serializeSettings,
} from '../core/dataFile';
import { createSettings } from '../core/defaults';
import type { DataFile, Settings } from '../core/types';

// data.json và settings.json nằm trong thư mục app data của máy này (SPEC mục 4):
//   Windows: %APPDATA%\com.familybudget.desktop
//   macOS:   ~/Library/Application Support/com.familybudget.desktop

const DATA_FILE = 'data.json';
const SETTINGS_FILE = 'settings.json';

let dirPromise: Promise<string> | null = null;

/** Đường dẫn thư mục app data, tạo thư mục nếu chưa có. */
export function getAppDir(): Promise<string> {
  dirPromise ??= (async () => {
    const dir = await appDataDir();
    await mkdir(dir, { recursive: true });
    return dir;
  })().catch((error: unknown) => {
    dirPromise = null; // lần sau thử lại
    throw error;
  });
  return dirPromise;
}

// Mọi lần ghi đi qua một hàng đợi để không bao giờ có 2 lần ghi cùng lúc
// (lần ghi sau luôn kết thúc sau lần ghi trước).
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task);
  writeQueue = run.catch(() => undefined);
  return run;
}

/** Chờ các lần ghi đang xếp hàng xong (trước khi app thoát để cài bản cập nhật). */
export async function flushWrites(): Promise<void> {
  let queue: Promise<unknown>;
  do {
    queue = writeQueue;
    await queue;
  } while (queue !== writeQueue);
}

/**
 * Ghi nguyên tử: ghi ra file tạm cùng thư mục rồi rename đè lên file đích.
 * Nếu app tắt giữa chừng thì file đích vẫn là bản cũ nguyên vẹn (SPEC mục 5).
 */
export async function writeFileAtomic(dir: string, name: string, content: string): Promise<void> {
  const target = await join(dir, name);
  const temp = await join(dir, `.${name}.tmp`);
  await writeTextFile(temp, content);
  await rename(temp, target);
}

async function readIfExists(name: string): Promise<string | null> {
  const path = await join(await getAppDir(), name);
  return (await exists(path)) ? readTextFile(path) : null;
}

/** Đọc settings.json; lần chạy đầu thì tạo mới với deviceId ngẫu nhiên. */
export async function loadSettings(): Promise<Settings> {
  const json = await readIfExists(SETTINGS_FILE);
  if (json !== null) return parseSettings(json);
  const settings = createSettings(crypto.randomUUID());
  await saveSettings(settings);
  return settings;
}

export function saveSettings(settings: Settings): Promise<void> {
  return enqueue(async () =>
    writeFileAtomic(await getAppDir(), SETTINGS_FILE, serializeSettings(settings)),
  );
}

/** Đọc data.json; null nếu chưa có. Ném lỗi nếu file hỏng — không bao giờ tự ghi đè. */
export async function loadData(): Promise<DataFile | null> {
  const json = await readIfExists(DATA_FILE);
  return json === null ? null : parseDataFile(json);
}

export function saveData(data: DataFile): Promise<void> {
  return enqueue(async () => {
    const content = serializeDataFile({ ...data, writtenAt: new Date().toISOString() });
    await writeFileAtomic(await getAppDir(), DATA_FILE, content);
  });
}

export async function getDataFilePath(): Promise<string> {
  return join(await getAppDir(), DATA_FILE);
}
