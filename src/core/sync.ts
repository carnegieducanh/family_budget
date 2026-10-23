import { parseDataFile } from './dataFile';
import { createEmptyData } from './defaults';
import { parseDeviceFileName } from './deviceFiles';
import { sameHousehold } from './household';
import { hasClockSkew, merge, sameRecords } from './merge';
import { SchemaTooNewError } from './migrations';
import { active } from './records';
import type { DataFile } from './types';

// Bước 3–5 của một lượt sync (SPEC mục 5), dạng hàm thuần: nhận nội dung thô các file
// của máy khác, trả về dữ liệu đã gộp. Việc đọc ghi file nằm ở sync/syncService.ts.

/** Một file của máy khác: nội dung thô, hoặc lỗi khi đọc file đó. */
export type RemoteFile = { name: string; content: string } | { name: string; error: string };

export type RemoteProblemReason = 'unreadable' | 'invalid' | 'encrypted' | 'other-household';

/** File bị bỏ qua trong lượt sync này. */
export interface RemoteProblem {
  name: string;
  reason: RemoteProblemReason;
  message: string;
}

/** Một file đọc và gộp được. */
export interface RemoteInfo {
  name: string;
  deviceId: string;
  writtenAt: string;
}

export type RemoteMergeResult =
  | { kind: 'schema-too-new'; name: string; version: number }
  | {
      kind: 'merged';
      data: DataFile;
      /** Kết quả khác dữ liệu local, cần backup rồi lưu lại. */
      changed: boolean;
      remotes: RemoteInfo[];
      problems: RemoteProblem[];
      clockSkew: boolean;
    };

/**
 * Gộp các file của máy khác vào dữ liệu local.
 * - File hỏng, sai cấu trúc hoặc của gia đình khác → bỏ qua file đó, ghi vào `problems`;
 *   không bao giờ dùng dữ liệu hỏng để ghi đè local.
 * - File có schemaVersion lớn hơn bản app hỗ trợ → dừng cả lượt sync, không gộp gì.
 * Local chưa có người dùng (máy đang tham gia) thì file đầu tiên quyết định gia đình.
 */
export function mergeRemoteFiles(
  local: DataFile,
  files: readonly RemoteFile[],
  now: Date,
): RemoteMergeResult {
  const sorted = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const remotes: RemoteInfo[] = [];
  const problems: RemoteProblem[] = [];
  let result = local;
  let clockSkew = false;

  for (const file of sorted) {
    if ('error' in file) {
      problems.push({ name: file.name, reason: 'unreadable', message: file.error });
      continue;
    }
    if (parseDeviceFileName(file.name)?.encrypted) {
      problems.push({
        name: file.name,
        reason: 'encrypted',
        message: 'File đã mã hóa, máy này chưa bật mã hóa nên không đọc được.',
      });
      continue;
    }

    let remote: DataFile;
    try {
      remote = parseDataFile(file.content);
    } catch (error) {
      if (error instanceof SchemaTooNewError) {
        return { kind: 'schema-too-new', name: file.name, version: error.version };
      }
      const message = error instanceof Error ? error.message : String(error);
      problems.push({ name: file.name, reason: 'invalid', message });
      continue;
    }

    if (result.users.length > 0 && !sameHousehold(result, remote)) {
      problems.push({
        name: file.name,
        reason: 'other-household',
        message: 'Dữ liệu của một gia đình khác (người dùng không khớp).',
      });
      continue;
    }

    clockSkew ||= hasClockSkew(remote, now);
    result = merge(result, remote);
    remotes.push({ name: file.name, deviceId: remote.deviceId, writtenAt: remote.writtenAt });
  }

  return {
    kind: 'merged',
    data: result,
    changed: !sameRecords(local, result),
    remotes,
    problems,
    clockSkew,
  };
}

export const SCHEMA_TOO_NEW_MESSAGE = 'Máy kia đang dùng bản mới hơn, hãy cập nhật app.';

export type JoinResult =
  | { kind: 'ok'; data: DataFile; problems: RemoteProblem[] }
  | { kind: 'error'; message: string; problems: RemoteProblem[] };

/** Máy thứ hai tham gia: dữ liệu gia đình gộp từ các file trong thư mục Drive. */
export function dataForJoin(deviceId: string, files: readonly RemoteFile[], now: Date): JoinResult {
  const result = mergeRemoteFiles(createEmptyData(deviceId, now), files, now);
  if (result.kind === 'schema-too-new') {
    return { kind: 'error', message: SCHEMA_TOO_NEW_MESSAGE, problems: [] };
  }
  const { problems } = result;
  if (result.remotes.length === 0) {
    return {
      kind: 'error',
      message:
        'Chưa thấy dữ liệu trong thư mục này. Trên máy admin, hãy tạo dữ liệu và chờ Google Drive đồng bộ xong, rồi thử lại.',
      problems,
    };
  }
  if (active(result.data.users).length !== 2) {
    return { kind: 'error', message: 'Dữ liệu trong thư mục phải có đúng 2 người dùng.', problems };
  }
  return { kind: 'ok', data: result.data, problems };
}

/**
 * Lý do không cho máy đã có dữ liệu kết nối với một thư mục; null nếu kết nối được.
 * Thư mục chứa dữ liệu của gia đình khác thì không gộp được (sẽ ra 4 người dùng).
 */
export function connectProblem(
  local: DataFile,
  files: readonly RemoteFile[],
  now: Date,
): string | null {
  const result = mergeRemoteFiles(local, files, now);
  // File của bản app mới hơn: vẫn cho kết nối, lượt sync sẽ báo cần cập nhật app.
  if (result.kind === 'schema-too-new') return null;
  if (result.problems.some((p) => p.reason === 'other-household')) {
    return 'Thư mục này chứa dữ liệu của một gia đình khác, không gộp được với dữ liệu trên máy này. Hãy chọn đúng thư mục.';
  }
  return null;
}
