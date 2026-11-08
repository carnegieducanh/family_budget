import { deviceFileName, parseDeviceFileName } from '../core/deviceFiles';
import type { SyncAdapter } from './SyncAdapter';

// Sync của bản web qua Google Apps Script (apps-script/Code.gs): script chạy bằng tài khoản Google
// của admin, đọc và ghi file `device-*.json` trong thư mục FamilyBudget trên Drive. Bản web gửi
// yêu cầu JSON tới URL ứng dụng web của script, kèm mã kết nối.

export interface ScriptConnection {
  /** URL ứng dụng web của script (`https://script.google.com/macros/s/.../exec`). */
  url: string;
  /** Mã kết nối do hàm caiDat của script tạo ra. */
  key: string;
}

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/** Script chạy trên máy chủ Google thường mất 1–3 giây; quá 30 giây thì coi như lỗi mạng. */
export const SCRIPT_TIMEOUT_MS = 30_000;

const CONNECT_HINT =
  'Kiểm tra mạng, link kết nối, và ứng dụng web đã chọn “Người có quyền truy cập: Bất kỳ ai”.';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Gửi một yêu cầu tới script; ném lỗi tiếng Việt khi mạng lỗi, link sai hoặc script báo lỗi. */
export async function callScript(
  connection: ScriptConnection,
  body: Record<string, unknown>,
  fetchFn: FetchFn = (url, init) => fetch(url, init),
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCRIPT_TIMEOUT_MS);
  let response: Response;
  try {
    // Thân là chuỗi, không đặt header: trình duyệt gửi dạng text/plain, không cần hỏi trước
    // (CORS preflight) — Apps Script không trả lời được yêu cầu hỏi trước.
    response = await fetchFn(connection.url, {
      method: 'POST',
      body: JSON.stringify({ ...body, key: connection.key }),
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch {
    throw new Error(
      controller.signal.aborted
        ? 'Google Apps Script không trả lời (quá 30 giây).'
        : `Không kết nối được tới Google Apps Script. ${CONNECT_HINT}`,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(`Google Apps Script báo lỗi HTTP ${response.status}. ${CONNECT_HINT}`);
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Link kết nối không phải ứng dụng web Family Budget. ${CONNECT_HINT}`);
  }
  if (!isObject(json)) throw new Error('Google Apps Script trả về dữ liệu không hợp lệ.');
  if (json.ok !== true) {
    throw new Error(
      typeof json.error === 'string' ? json.error : 'Google Apps Script trả về lỗi không rõ.',
    );
  }
  return json;
}

/** Bản sao các file của máy khác đã tải ở lượt trước, kèm thời điểm sửa trên Drive. */
export interface CachedFiles {
  /** URL script lúc tải: đổi kết nối thì không dùng bản sao cũ. */
  url: string;
  files: Record<string, { modified: string; content: string }>;
}

/** Nơi giữ CachedFiles giữa các lần mở app (bản web: IndexedDB). */
export interface RemoteFileCache {
  load(): Promise<CachedFiles | null>;
  save(files: CachedFiles): Promise<void>;
}

/**
 * Lỗi script bản cũ (chưa có yêu cầu `sync`) trả về cho yêu cầu lạ: khi đó dùng cách cũ, ghi rồi
 * đọc bằng 2 lần gọi, để điện thoại vẫn sync được trong lúc admin chưa cập nhật script.
 */
const OLD_SCRIPT_ERROR = 'Yêu cầu không hợp lệ.';

interface ScriptFile {
  name: string;
  modified: string | null;
  /** null: script báo file không đổi so với bản sao trên máy. */
  content: string | null;
}

/** File của máy khác trong câu trả lời của script (bỏ file lạ và file của chính máy này). */
function scriptFiles(result: Record<string, unknown>, deviceId: string): ScriptFile[] {
  const files: ScriptFile[] = [];
  for (const file of Array.isArray(result.files) ? result.files : []) {
    if (!isObject(file) || typeof file.name !== 'string') continue;
    const info = parseDeviceFileName(file.name);
    if (!info || info.deviceId === deviceId) continue;
    const content = typeof file.content === 'string' ? file.content : null;
    if (content === null && file.unchanged !== true) continue;
    const modified = typeof file.modified === 'string' ? file.modified : null;
    files.push({ name: file.name, modified, content });
  }
  return files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * SyncAdapter qua script. Lượt sync dùng `exchange`: một lần gọi vừa ghi file của máy này vừa lấy
 * file của máy khác, và script chỉ gửi nội dung file đã sửa kể từ bản sao giữ trên máy (`cache`).
 * `listRemote`/`readRemote` (đọc hết, một lần gọi) dùng khi thiết lập và khi đổi kết nối.
 * Bản web không mã hóa file (không có mục Mã hóa).
 */
export function createScriptAdapter(
  connection: ScriptConnection,
  deviceId: string,
  options: { fetchFn?: FetchFn; cache?: RemoteFileCache } = {},
): SyncAdapter {
  const { fetchFn, cache } = options;
  let contents = new Map<string, string>();
  const ownName = deviceFileName(deviceId);

  async function list(): Promise<{ name: string; content: string }[]> {
    const result = await callScript(connection, { action: 'list', exclude: deviceId }, fetchFn);
    return scriptFiles(result, deviceId).flatMap(({ name, content }) =>
      content === null ? [] : [{ name, content }],
    );
  }

  /** Bản sao trên máy, nếu đúng của kết nối này; lỗi đọc thì coi như chưa có. */
  async function loadCache(): Promise<CachedFiles['files']> {
    try {
      const cached = await cache?.load();
      return cached?.url === connection.url && isObject(cached.files) ? cached.files : {};
    } catch {
      return {};
    }
  }

  return {
    // Không có cách kiểm tra rẻ hơn một lần gọi; lỗi kết nối được báo khi đọc.
    async isReady() {
      return true;
    },

    async listRemote() {
      const files = await list();
      contents = new Map(files.map((f) => [f.name, f.content]));
      return files.map(({ name }) => ({
        name,
        deviceId: parseDeviceFileName(name)?.deviceId ?? '',
      }));
    },

    async readRemote(name) {
      const content = contents.get(name);
      if (content === undefined) throw new Error(`Không có file ${name} trong lần đọc vừa rồi.`);
      return content;
    },

    async writeOwn(content) {
      await callScript(connection, { action: 'write', name: ownName, content }, fetchFn);
    },

    async exchange(ownContent) {
      const cached = await loadCache();
      const known = Object.fromEntries(Object.entries(cached).map(([n, f]) => [n, f.modified]));
      const own = ownContent === null ? {} : { name: ownName, content: ownContent };
      let result: Record<string, unknown>;
      try {
        result = await callScript(
          connection,
          { action: 'sync', exclude: deviceId, known, ...own },
          fetchFn,
        );
      } catch (error) {
        if (!(error instanceof Error) || error.message !== OLD_SCRIPT_ERROR) throw error;
        if (ownContent !== null) {
          await callScript(
            connection,
            { action: 'write', name: ownName, content: ownContent },
            fetchFn,
          );
        }
        return list();
      }

      const files: { name: string; content: string }[] = [];
      const next: CachedFiles['files'] = {};
      for (const { name, modified, content: sent } of scriptFiles(result, deviceId)) {
        const content = sent ?? cached[name]?.content;
        if (content === undefined)
          throw new Error(`Script báo ${name} không đổi nhưng máy chưa có bản sao.`);
        files.push({ name, content });
        if (modified) next[name] = { modified, content };
      }
      try {
        await cache?.save({ url: connection.url, files: next });
      } catch (error) {
        // Không lưu được bản sao: lần sau script gửi lại đủ các file, không mất gì.
        console.warn('Không lưu được bản sao file của máy khác:', error);
      }
      return files;
    },
  };
}
