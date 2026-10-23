import dayjs from 'dayjs';
import { addMonths, toMonth } from './month';

// Tên và quy tắc giữ snapshot backup (SPEC mục 9). Snapshot tên
// `data-YYYYMMDD-HHmmss.json` theo giờ local; nếu trùng giây thì thêm `-2`, `-3`...

/** Số snapshot gần nhất luôn được giữ. */
export const KEEP_RECENT = 30;
/** Số tháng gần nhất (tính cả tháng này) được giữ snapshot đầu tiên của tháng. */
export const KEEP_MONTHS = 12;

const SNAPSHOT_RE = /^data-(\d{4})(\d{2})(\d{2})-(\d{6})(?:-(\d+))?\.json$/;

export interface SnapshotInfo {
  name: string;
  /** YYYY-MM theo giờ local. */
  month: string;
  /** Khóa sắp xếp theo thời gian tạo, so sánh được trực tiếp. */
  sortKey: string;
  /** Thời điểm tạo theo giờ local, dạng "23/10/2026 14:05:09". */
  label: string;
}

export function parseSnapshotName(name: string): SnapshotInfo | null {
  const match = SNAPSHOT_RE.exec(name);
  if (!match) return null;
  const [, year, month, day, time, seq] = match;
  return {
    name,
    month: `${year}-${month}`,
    sortKey: `${year}${month}${day}${time}-${(seq ?? '1').padStart(6, '0')}`,
    label: `${day}/${month}/${year} ${time?.slice(0, 2)}:${time?.slice(2, 4)}:${time?.slice(4, 6)}`,
  };
}

/** Tên file cho snapshot mới, không trùng với các tên đã có. */
export function snapshotFileName(now: Date, existing: Iterable<string>): string {
  const base = `data-${dayjs(now).format('YYYYMMDD-HHmmss')}`;
  const taken = new Set(existing);
  let name = `${base}.json`;
  for (let seq = 2; taken.has(name); seq++) name = `${base}-${seq}.json`;
  return name;
}

/**
 * Các snapshot cần xóa: giữ 30 bản gần nhất, cộng bản đầu tiên của mỗi tháng trong
 * 12 tháng gần nhất. File có tên không đúng mẫu không bao giờ bị xóa.
 */
export function snapshotsToPrune(names: Iterable<string>, now: Date): string[] {
  const snapshots = [...names]
    .map(parseSnapshotName)
    .filter((info): info is SnapshotInfo => info !== null)
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));

  const keep = new Set(snapshots.slice(0, KEEP_RECENT).map((s) => s.name));

  const currentMonth = toMonth(now);
  const oldestMonth = addMonths(currentMonth, -(KEEP_MONTHS - 1));
  const firstOfMonth = new Map<string, SnapshotInfo>();
  for (const snapshot of snapshots) {
    // Danh sách mới nhất trước, nên bản gặp sau cùng của mỗi tháng là bản đầu tiên.
    if (snapshot.month >= oldestMonth && snapshot.month <= currentMonth) {
      firstOfMonth.set(snapshot.month, snapshot);
    }
  }
  for (const snapshot of firstOfMonth.values()) keep.add(snapshot.name);

  return snapshots.filter((s) => !keep.has(s.name)).map((s) => s.name);
}
