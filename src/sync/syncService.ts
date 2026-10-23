import { serializeDataFile } from '../core/dataFile';
import {
  mergeRemoteFiles,
  type RemoteFile,
  type RemoteInfo,
  type RemoteProblem,
} from '../core/sync';
import type { DataFile } from '../core/types';
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

export interface SyncEnv {
  /** Adapter theo cài đặt hiện tại; null khi chưa chọn thư mục Drive. */
  adapter(): SyncAdapter | null;
  /** Dữ liệu local mới nhất trong bộ nhớ. */
  getData(): DataFile;
  /** Snapshot dữ liệu local trước khi bị thay bằng kết quả merge. */
  backup(data: DataFile): Promise<void>;
  /** Thay dữ liệu local bằng kết quả merge: cập nhật bộ nhớ và lưu data.json. */
  applyMerged(data: DataFile): void;
  now(): Date;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failed(label: string, error: unknown): SyncOutcome {
  return { kind: 'failed', message: `${label}: ${errorMessage(error)}` };
}

/** Đọc mọi file của máy khác. File đọc lỗi được ghi lại lỗi, không làm hỏng cả lượt. */
export async function readRemoteFiles(adapter: SyncAdapter): Promise<RemoteFile[]> {
  const files: RemoteFile[] = [];
  for (const { name } of await adapter.listRemote()) {
    try {
      files.push({ name, content: await adapter.readRemote(name) });
    } catch (error) {
      files.push({ name, error: errorMessage(error) });
    }
  }
  return files;
}

/** Một lượt sync: đọc file máy khác, gộp, backup + lưu nếu có thay đổi, ghi file của mình. */
export async function syncOnce(env: SyncEnv): Promise<SyncOutcome> {
  const adapter = env.adapter();
  if (!adapter) return { kind: 'not-configured' };
  if (!(await adapter.isReady())) return { kind: 'folder-missing' };

  let files: RemoteFile[];
  try {
    files = await readRemoteFiles(adapter);
  } catch (error) {
    return failed('Không đọc được thư mục Drive', error);
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
  try {
    await adapter.writeOwn(serializeDataFile({ ...env.getData(), writtenAt: now.toISOString() }));
  } catch (error) {
    return failed('Không ghi được file lên thư mục Drive', error);
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
  /** Có thay đổi local (debounce 10 giây). */
  notifyLocalChange(): void;
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
      debounceTimer = setTimeout(() => void request(), LOCAL_CHANGE_DELAY_MS);
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
