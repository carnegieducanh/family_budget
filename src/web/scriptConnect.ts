import { DomainError } from '../core/errors';
import { connectProblem, type RemoteFile } from '../core/sync';
import { useDataStore } from '../state/dataStore';
import { createScriptAdapter, type ScriptConnection } from '../storage/scriptAdapter';
import { syncNow } from '../sync/appSync';
import { openRemoteFiles, readRemoteFiles } from '../sync/syncService';

// Kết nối bản web với Google Apps Script: thiết lập lần đầu và Cài đặt → Đồng bộ.

/** Link và mã người dùng dán vào; bỏ khoảng trắng thừa, ném lỗi nếu link không hợp lệ. */
export function parseConnection(url: string, key: string): ScriptConnection {
  const trimmedUrl = url.trim();
  const trimmedKey = key.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    throw new DomainError('Link chưa đúng: hãy dán nguyên URL ứng dụng web của script.');
  }
  // http chỉ cho máy đang chạy thử (localhost); link thật của Apps Script luôn là https.
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new DomainError('Link phải bắt đầu bằng https://');
  }
  if (!trimmedKey) throw new DomainError('Hãy nhập mã kết nối.');
  return { url: trimmedUrl, key: trimmedKey };
}

/** Đọc các file của các máy qua script (bản web không đọc file mã hóa). */
export async function readFamilyFiles(
  connection: ScriptConnection,
  deviceId: string,
): Promise<RemoteFile[]> {
  return openRemoteFiles(await readRemoteFiles(createScriptAdapter(connection, deviceId)), null);
}

/**
 * Đổi kết nối của máy đã có dữ liệu (Cài đặt), rồi sync ngay. Ném lỗi nếu script chưa thấy dữ
 * liệu nào, hoặc thư mục của script là dữ liệu của gia đình khác.
 */
export async function connectScript(connection: ScriptConnection): Promise<void> {
  const { settings, data } = useDataStore.getState();
  if (!settings) throw new Error('Chưa đọc được settings.');
  const files = await readFamilyFiles(connection, settings.deviceId);
  if (files.length === 0) {
    throw new DomainError(
      'Thư mục mà script đang dùng chưa có dữ liệu của máy nào. Kiểm tra lại thư mục trong script.',
    );
  }
  const problem = data && connectProblem(data, files, new Date());
  if (problem) throw new DomainError(problem);
  await useDataStore
    .getState()
    .updateSettings({ syncFolder: connection.url, syncKey: connection.key });
  void syncNow();
}
