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

/**
 * SyncAdapter qua script. Một lượt sync gọi script 2 lần: `listRemote` lấy luôn nội dung mọi
 * file của máy khác (các `readRemote` sau đó đọc lại từ đó), và `writeOwn` ghi file của máy này.
 * Bản web không mã hóa file (không có mục Mã hóa).
 */
export function createScriptAdapter(
  connection: ScriptConnection,
  deviceId: string,
  fetchFn?: FetchFn,
): SyncAdapter {
  let contents = new Map<string, string>();

  return {
    // Không có cách kiểm tra rẻ hơn một lần gọi; lỗi kết nối được báo ở listRemote.
    async isReady() {
      return true;
    },

    async listRemote() {
      const result = await callScript(connection, { action: 'list', exclude: deviceId }, fetchFn);
      const files = Array.isArray(result.files) ? result.files : [];
      contents = new Map();
      for (const file of files) {
        if (!isObject(file) || typeof file.name !== 'string' || typeof file.content !== 'string') {
          continue;
        }
        const info = parseDeviceFileName(file.name);
        if (info && info.deviceId !== deviceId) contents.set(file.name, file.content);
      }
      return [...contents.keys()].sort().map((name) => ({
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
      await callScript(
        connection,
        { action: 'write', name: deviceFileName(deviceId), content },
        fetchFn,
      );
    },
  };
}
