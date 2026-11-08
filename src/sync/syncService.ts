import { serializeDataFile } from '../core/dataFile';
import { parseDeviceFileName } from '../core/deviceFiles';
import {
  mergeRemoteFiles,
  type RemoteFile,
  type RemoteInfo,
  type RemoteProblem,
} from '../core/sync';
import type { DataFile } from '../core/types';
import { DecryptError, decryptFile, encryptFile, type FileKey } from '../storage/crypto';
import type { SyncAdapter } from '../storage/SyncAdapter';

// Lượt sync và lịch sync (SPEC mục 5). Chỉ làm việc qua SyncAdapter và các hàm được
// truyền vào, không import Tauri hay store, nên test được bằng adapter giả.

export type SyncOutcome =
  | { kind: 'not-configured' }
  | { kind: 'folder-missing' }
  | { kind: 'schema-too-new'; version: number }
  | { kind: 'failed'; message: string }
  | {
      kind: 'ok';
      at: string;
      /** Dữ liệu local đã thay đổi sau khi gộp. */
      changed: boolean;
      remotes: RemoteInfo[];
      problems: RemoteProblem[];
      clockSkew: boolean;
    };

/** Nơi sync và khóa mã hóa, lấy cùng lúc từ cài đặt hiện tại. */
export interface SyncTarget {
  adapter: SyncAdapter;
  /** Khóa đọc file `.enc.json` của máy khác; null nếu máy này chưa có mật khẩu. */
  readKey: FileKey | null;
  /**
   * Khóa mã hóa file của máy này; null thì ghi dạng thường. Adapter phải được tạo để ghi
   * đúng tên file tương ứng (`.enc.json` hoặc `.json`).
   */
  writeKey: FileKey | null;
  /** Người dùng của máy này, ghi vào file để máy kia hiện "Máy <tên>"; null khi chưa thiết lập. */
  writtenBy: string | null;
  /** Nơi ghi (đường dẫn thư mục, URL script): đổi nơi sync thì ghi lại dù dữ liệu không đổi. */
  location?: string;
}

/** Lần ghi file của máy này gần nhất: dấu nội dung (nơi ghi, kiểu mã hóa, dữ liệu) và thời điểm. */
export interface LastWrite {
  mark: string;
  at: number;
}

export interface SyncEnv {
  /** Nơi sync theo cài đặt hiện tại; null khi chưa chọn thư mục Drive. */
  target(): Promise<SyncTarget | null>;
  /** Dữ liệu local mới nhất trong bộ nhớ. */
  getData(): DataFile;
  /** Snapshot dữ liệu local trước khi bị thay bằng kết quả merge. */
  backup(data: DataFile): Promise<void>;
  /** Thay dữ liệu local bằng kết quả merge: cập nhật bộ nhớ và lưu data.json. */
  applyMerged(data: DataFile): void;
  now(): Date;
  /**
   * Nhớ lần ghi file của máy này gần nhất (trong bộ nhớ), để không ghi lại file y hệt mỗi lượt.
   * Không có thì lượt nào cũng ghi.
   */
  lastWrite?: { get(): LastWrite | null; set(value: LastWrite): void };
}

/**
 * Dữ liệu không đổi thì vẫn ghi lại file của máy này sau chừng này thời gian: file trên Drive bị
 * xóa nhầm thì tự có lại, và máy khác vẫn thấy "ghi dữ liệu lúc" gần đây.
 */
export const REWRITE_AFTER_MS = 6 * 60 * 60 * 1000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failed(label: string, error: unknown): SyncOutcome {
  return { kind: 'failed', message: `${label}: ${errorMessage(error)}` };
}

/** File đọc từ thư mục Drive: nội dung thô (có thể đã mã hóa) hoặc lỗi khi đọc. */
export type RawRemoteFile = { name: string; content: string } | { name: string; error: string };

/** Đọc mọi file của máy khác. File đọc lỗi được ghi lại lỗi, không làm hỏng cả lượt. */
export async function readRemoteFiles(adapter: SyncAdapter): Promise<RawRemoteFile[]> {
  const files: RawRemoteFile[] = [];
  for (const { name } of await adapter.listRemote()) {
    try {
      files.push({ name, content: await adapter.readRemote(name) });
    } catch (error) {
      files.push({ name, error: errorMessage(error) });
    }
  }
  return files;
}

export const NEEDS_PASSWORD_MESSAGE =
  'Máy kia đã bật mã hóa. Nhập mật khẩu chung ở Cài đặt → Mã hóa để đọc file này.';

/**
 * Giải mã các file `.enc.json` bằng khóa của máy này (SPEC mục 9). File không giải mã được
 * (chưa có mật khẩu, sai mật khẩu, sai cấu trúc) thành lý do bỏ qua, không bao giờ được gộp.
 */
export function openRemoteFiles(
  files: readonly RawRemoteFile[],
  key: FileKey | null,
): Promise<RemoteFile[]> {
  return Promise.all(
    files.map(async (file): Promise<RemoteFile> => {
      const { name } = file;
      if ('error' in file) return { name, reason: 'unreadable', message: file.error };
      if (!parseDeviceFileName(name)?.encrypted) return file;
      if (!key) return { name, reason: 'encrypted', message: NEEDS_PASSWORD_MESSAGE };
      try {
        return { name, content: await decryptFile(file.content, key) };
      } catch (error) {
        const reason = error instanceof DecryptError ? 'decrypt-failed' : 'invalid';
        return { name, reason, message: errorMessage(error) };
      }
    }),
  );
}

/**
 * File của máy này cần ghi lên nơi sync (mã hóa nếu máy này bật mã hóa); null nếu giống hệt lần
 * ghi trước (cùng nơi ghi, cùng kiểu mã hóa, cùng dữ liệu) và lần đó chưa quá REWRITE_AFTER_MS.
 */
async function ownFile(
  env: SyncEnv,
  target: SyncTarget,
  now: Date,
): Promise<{ content: string; write: LastWrite } | null> {
  const data = env.getData();
  const by = target.writtenBy ? { writtenBy: target.writtenBy } : {};
  const mark = [
    target.location ?? '',
    target.writeKey ? 'enc' : 'plain',
    serializeDataFile({ ...data, writtenAt: '', ...by }),
  ].join('|');
  const last = env.lastWrite?.get();
  if (last && last.mark === mark && now.getTime() - last.at < REWRITE_AFTER_MS) return null;
  const json = serializeDataFile({ ...data, writtenAt: now.toISOString(), ...by });
  const content = target.writeKey ? await encryptFile(json, target.writeKey) : json;
  return { content, write: { mark, at: now.getTime() } };
}

/**
 * Một lượt sync: đọc và giải mã file máy khác, gộp, backup + lưu nếu có thay đổi, rồi ghi
 * file của mình (nếu khác lần ghi trước).
 *
 * Nơi sync có `exchange` (Google Apps Script, mỗi lần gọi mất 1–3 giây) thì ghi và đọc trong
 * một lần gọi: ghi file của máy này với dữ liệu trước khi gộp, phần vừa gộp được ghi ở lượt sau.
 * Máy khác không thiếu gì vì phần đó vốn đến từ file của chúng.
 */
export async function syncOnce(env: SyncEnv): Promise<SyncOutcome> {
  let target: SyncTarget | null;
  try {
    target = await env.target();
  } catch (error) {
    return failed('Không đọc được khóa mã hóa trên máy này', error);
  }
  if (!target) return { kind: 'not-configured' };
  const { adapter, readKey } = target;
  if (!(await adapter.isReady())) return { kind: 'folder-missing' };

  let files: RemoteFile[];
  if (adapter.exchange) {
    try {
      const own = await ownFile(env, target, env.now());
      const raw = await adapter.exchange(own?.content ?? null);
      if (own) env.lastWrite?.set(own.write);
      files = await openRemoteFiles(raw, readKey);
    } catch (error) {
      return failed('Không đồng bộ được với thư mục Drive', error);
    }
  } else {
    try {
      files = await openRemoteFiles(await readRemoteFiles(adapter), readKey);
    } catch (error) {
      return failed('Không đọc được thư mục Drive', error);
    }
  }

  const before = env.getData();
  const result = mergeRemoteFiles(before, files, env.now());
  if (result.kind === 'schema-too-new') return { kind: 'schema-too-new', version: result.version };

  if (result.changed) {
    try {
      await env.backup(before);
    } catch (error) {
      return failed('Không tạo được backup trước khi gộp dữ liệu', error);
    }
    // Người dùng có thể vừa sửa dữ liệu trong lúc ghi backup: gộp lại vào bản mới nhất.
    const latest = env.getData();
    const final = latest === before ? result : mergeRemoteFiles(latest, files, env.now());
    if (final.kind === 'merged' && final.changed) env.applyMerged(final.data);
  }

  const now = env.now();
  if (!adapter.exchange) {
    try {
      const own = await ownFile(env, target, now);
      if (own) {
        await adapter.writeOwn(own.content);
        env.lastWrite?.set(own.write);
      }
    } catch (error) {
      return failed('Không ghi được file lên thư mục Drive', error);
    }
  }

  return {
    kind: 'ok',
    at: now.toISOString(),
    changed: result.changed,
    remotes: result.remotes,
    problems: result.problems,
    clockSkew: result.clockSkew,
  };
}

/** Sau thay đổi local: ghi file Drive khi đã 10 giây không có thay đổi mới. */
export const LOCAL_CHANGE_DELAY_MS = 10_000;
/** Focus lại cửa sổ trong vòng 30 giây sau lượt sync trước thì không sync nữa. */
export const FOCUS_MIN_GAP_MS = 30_000;

export interface SyncScheduler {
  /**
   * Yêu cầu một lượt sync. Đang có lượt chạy thì mọi yêu cầu đến sau được gộp thành
   * một lượt chạy tiếp theo. Promise trả về kết quả của lượt bao gồm yêu cầu này.
   */
  request(): Promise<SyncOutcome>;
  /** Có thay đổi local (debounce 10 giây, bản web ngắn hơn). */
  notifyLocalChange(): void;
  /** Đang chờ debounce sau thay đổi local thì sync ngay (người dùng rời app). */
  flushLocalChange(): void;
  /** Cửa sổ app được focus lại. */
  notifyFocus(): void;
  /** Đặt chu kỳ sync định kỳ. */
  setIntervalMinutes(minutes: number): void;
  /** Dừng mọi bộ hẹn giờ. */
  stop(): void;
}

export interface SchedulerHooks {
  onStart?(): void;
  onFinish?(outcome: SyncOutcome): void;
}

export function createSyncScheduler(
  run: () => Promise<SyncOutcome>,
  hooks: SchedulerHooks = {},
  localChangeDelayMs = LOCAL_CHANGE_DELAY_MS,
): SyncScheduler {
  let loop: Promise<void> | null = null;
  let waiters: Array<(outcome: SyncOutcome) => void> = [];
  let lastFinishedAt = Number.NEGATIVE_INFINITY;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let intervalTimer: ReturnType<typeof setInterval> | undefined;

  async function runSafely(): Promise<SyncOutcome> {
    try {
      return await run();
    } catch (error) {
      return { kind: 'failed', message: errorMessage(error) };
    }
  }

  // Khóa chống chạy song song: chỉ một vòng lặp chạy tại một thời điểm, mỗi vòng phục vụ
  // tất cả yêu cầu đến trước khi vòng đó bắt đầu.
  async function drain(): Promise<void> {
    while (waiters.length > 0) {
      const batch = waiters;
      waiters = [];
      hooks.onStart?.();
      const outcome = await runSafely();
      lastFinishedAt = Date.now();
      hooks.onFinish?.(outcome);
      for (const resolve of batch) resolve(outcome);
    }
    loop = null;
  }

  function request(): Promise<SyncOutcome> {
    const promise = new Promise<SyncOutcome>((resolve) => waiters.push(resolve));
    loop ??= drain();
    return promise;
  }

  return {
    request,

    notifyLocalChange() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        void request();
      }, localChangeDelayMs);
    },

    flushLocalChange() {
      if (debounceTimer === undefined) return;
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
      void request();
    },

    notifyFocus() {
      if (loop || Date.now() - lastFinishedAt < FOCUS_MIN_GAP_MS) return;
      void request();
    },

    setIntervalMinutes(minutes) {
      clearInterval(intervalTimer);
      intervalTimer = setInterval(() => void request(), minutes * 60_000);
    },

    stop() {
      clearTimeout(debounceTimer);
      clearInterval(intervalTimer);
    },
  };
}
