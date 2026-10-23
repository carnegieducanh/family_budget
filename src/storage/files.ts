import { downloadDir, join } from '@tauri-apps/api/path';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { DomainError } from '../core/errors';

// Mở và lưu file do người dùng chọn (CSV, backup JSON). Hộp chọn file cấp quyền đọc ghi
// đúng file được chọn, không cấp quyền gì khác.

export type FileKind = 'csv' | 'json';

const FILTERS: Record<FileKind, { name: string; extensions: string[] }[]> = {
  csv: [{ name: 'CSV', extensions: ['csv'] }],
  json: [{ name: 'Backup JSON', extensions: ['json'] }],
};

/** Hộp chọn file để mở; null nếu người dùng bấm hủy. */
export async function chooseFileToOpen(kind: FileKind, title: string): Promise<string | null> {
  const selected = await open({ title, filters: FILTERS[kind], multiple: false, directory: false });
  return typeof selected === 'string' ? selected : null;
}

/** Hộp lưu file, mặc định trong thư mục Tải xuống; null nếu người dùng bấm hủy. */
export async function chooseFileToSave(
  kind: FileKind,
  title: string,
  fileName: string,
): Promise<string | null> {
  let defaultPath = fileName;
  try {
    defaultPath = await join(await downloadDir(), fileName);
  } catch {
    // Không xác định được thư mục Tải xuống: để hộp thoại tự chọn thư mục.
  }
  return save({ title, filters: FILTERS[kind], defaultPath });
}

/** Đọc file văn bản UTF-8. Báo rõ khi file dùng bảng mã khác (ví dụ CSV lưu từ Excel). */
export async function readUtf8File(path: string): Promise<string> {
  const bytes = await readFile(path);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new DomainError(
      'File không phải UTF-8. Trong Excel, hãy lưu bằng "Save As" → "CSV UTF-8 (Comma delimited)".',
    );
  }
}

export function writeTextFileTo(path: string, content: string): Promise<void> {
  return writeTextFile(path, content);
}
