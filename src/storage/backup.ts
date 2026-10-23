import { join } from '@tauri-apps/api/path';
import { exists, mkdir, readDir, readTextFile, remove } from '@tauri-apps/plugin-fs';
import {
  parseSnapshotName,
  snapshotFileName,
  snapshotsToPrune,
  type SnapshotInfo,
} from '../core/backups';
import { parseDataFile, serializeDataFile } from '../core/dataFile';
import type { DataFile } from '../core/types';
import { getAppDir, writeFileAtomic } from './localStore';

// Snapshot dữ liệu vào `<appData>/backups/` (SPEC mục 9): trước mỗi lần merge làm thay
// đổi dữ liệu (giai đoạn 2), trước import CSV và trước khi khôi phục (giai đoạn 3).

const BACKUP_DIR = 'backups';

export async function getBackupDir(): Promise<string> {
  return join(await getAppDir(), BACKUP_DIR);
}

/** Lưu snapshot của `data`, rồi xóa các snapshot cũ theo quy tắc giữ. Trả về tên file. */
export async function createSnapshot(data: DataFile, now = new Date()): Promise<string> {
  const dir = await getBackupDir();
  await mkdir(dir, { recursive: true });
  const names = (await readDir(dir)).filter((e) => e.isFile).map((e) => e.name);
  const name = snapshotFileName(now, names);
  await writeFileAtomic(dir, name, serializeDataFile(data));

  for (const old of snapshotsToPrune([...names, name], now)) {
    try {
      await remove(await join(dir, old));
    } catch (error) {
      // Snapshot mới đã lưu xong; bản cũ chưa xóa được thì lần sau dọn tiếp.
      console.warn(`Không xóa được backup cũ ${old}:`, error);
    }
  }
  return name;
}

/** Các snapshot đang có, mới nhất trước. */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const dir = await getBackupDir();
  if (!(await exists(dir))) return [];
  return (await readDir(dir))
    .filter((e) => e.isFile)
    .map((e) => parseSnapshotName(e.name))
    .filter((info): info is SnapshotInfo => info !== null)
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));
}

/** Đọc một snapshot (nâng cấp version nếu là bản cũ). */
export async function readSnapshot(name: string): Promise<DataFile> {
  return parseDataFile(await readTextFile(await join(await getBackupDir(), name)));
}
