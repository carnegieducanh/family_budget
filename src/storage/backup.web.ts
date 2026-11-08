import {
  parseSnapshotName,
  snapshotFileName,
  snapshotsToPrune,
  type SnapshotInfo,
} from '../core/backups';
import { parseDataFile, serializeDataFile } from '../core/dataFile';
import type { DataFile } from '../core/types';
import { idbDelete, idbGet, idbNames, idbSet } from './idb';

// Bản web của backup.ts: snapshot nằm trong IndexedDB (storage/idb.ts) với tên
// `backups/data-YYYYMMDD-HHmmss.json`, cùng quy tắc giữ như app desktop (SPEC mục 9).

const PREFIX = 'backups/';

async function snapshotNames(): Promise<string[]> {
  return (await idbNames(PREFIX)).map((key) => key.slice(PREFIX.length));
}

/** Lưu snapshot của `data`, rồi xóa các snapshot cũ theo quy tắc giữ. Trả về tên snapshot. */
export async function createSnapshot(data: DataFile, now = new Date()): Promise<string> {
  const names = await snapshotNames();
  const name = snapshotFileName(now, names);
  await idbSet(PREFIX + name, serializeDataFile(data));

  for (const old of snapshotsToPrune([...names, name], now)) {
    try {
      await idbDelete(PREFIX + old);
    } catch (error) {
      // Snapshot mới đã lưu xong; bản cũ chưa xóa được thì lần sau dọn tiếp.
      console.warn(`Không xóa được backup cũ ${old}:`, error);
    }
  }
  return name;
}

/** Các snapshot đang có, mới nhất trước. */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  return (await snapshotNames())
    .map((name) => parseSnapshotName(name))
    .filter((info): info is SnapshotInfo => info !== null)
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));
}

/** Đọc một snapshot (nâng cấp version nếu là bản cũ). */
export async function readSnapshot(name: string): Promise<DataFile> {
  const json = await idbGet(PREFIX + name);
  if (json === null) throw new Error(`Không tìm thấy backup ${name}.`);
  return parseDataFile(json);
}
