import { describe, expect, it } from 'vitest';
import { parseSnapshotName, snapshotFileName, snapshotsToPrune } from './backups';
import { localTime } from './testing';

/** Tên snapshot cho một thời điểm local. */
function name(year: number, month: number, day: number, h = 12, m = 0, s = 0): string {
  return snapshotFileName(localTime(year, month, day, h, m, s), []);
}

describe('snapshotFileName', () => {
  it('đặt tên theo giờ local', () => {
    expect(snapshotFileName(localTime(2026, 10, 23, 14, 5, 9), [])).toBe(
      'data-20261023-140509.json',
    );
  });

  it('trùng giây thì thêm số thứ tự, không ghi đè snapshot cũ', () => {
    const now = localTime(2026, 10, 23, 14, 5, 9);
    expect(snapshotFileName(now, ['data-20261023-140509.json'])).toBe(
      'data-20261023-140509-2.json',
    );
    expect(
      snapshotFileName(now, ['data-20261023-140509.json', 'data-20261023-140509-2.json']),
    ).toBe('data-20261023-140509-3.json');
  });
});

describe('parseSnapshotName', () => {
  it('đọc tháng và thời điểm từ tên file', () => {
    expect(parseSnapshotName('data-20261023-140509.json')).toMatchObject({
      month: '2026-10',
      label: '23/10/2026 14:05:09',
    });
    expect(parseSnapshotName('data-20261023-140509-2.json')?.month).toBe('2026-10');
  });

  it('bỏ qua file tạm và file lạ', () => {
    expect(parseSnapshotName('.data-20261023-140509.json.tmp')).toBeNull();
    expect(parseSnapshotName('notes.txt')).toBeNull();
    expect(parseSnapshotName('data-2026-10-23.json')).toBeNull();
  });

  it('bản thêm số thứ tự xếp sau bản gốc cùng giây', () => {
    const first = parseSnapshotName('data-20261023-140509.json');
    const second = parseSnapshotName('data-20261023-140509-2.json');
    const tenth = parseSnapshotName('data-20261023-140509-10.json');
    expect(first && second && first.sortKey < second.sortKey).toBe(true);
    expect(second && tenth && second.sortKey < tenth.sortKey).toBe(true);
  });
});

describe('snapshotsToPrune', () => {
  const NOW = localTime(2026, 10, 23);

  it('ít hơn 30 snapshot → không xóa gì', () => {
    const names = Array.from({ length: 30 }, (_, i) => name(2026, 10, 1, 0, i));
    expect(snapshotsToPrune(names, NOW)).toEqual([]);
  });

  it('giữ 30 bản gần nhất cộng bản đầu tiên của tháng', () => {
    const names = Array.from({ length: 40 }, (_, i) => name(2026, 10, 1, 0, i));
    const pruned = snapshotsToPrune(names, NOW);
    // 40 bản trong cùng tháng: giữ 30 bản mới nhất (phút 10–39) và bản đầu tháng (phút 0).
    expect(pruned).toEqual(names.slice(1, 10).reverse());
  });

  it('giữ bản đầu tiên của mỗi tháng trong 12 tháng gần nhất, xóa tháng cũ hơn', () => {
    const monthly: string[] = [];
    for (let back = 0; back < 15; back++) {
      const date = new Date(2026, 9 - back, 1);
      const [y, m] = [date.getFullYear(), date.getMonth() + 1];
      monthly.push(name(y, m, 2), name(y, m, 20));
    }
    const recent = Array.from({ length: 30 }, (_, i) => name(2026, 10, 22, 0, i));
    const pruned = new Set(snapshotsToPrune([...monthly, ...recent], NOW));

    // 11/2025 → 10/2026: giữ bản ngày 2, xóa bản ngày 20.
    expect(pruned.has(name(2025, 11, 2))).toBe(false);
    expect(pruned.has(name(2025, 11, 20))).toBe(true);
    expect(pruned.has(name(2026, 10, 2))).toBe(false);
    // 10/2025 trở về trước: xóa hết.
    expect(pruned.has(name(2025, 10, 2))).toBe(true);
    expect(pruned.has(name(2025, 8, 2))).toBe(true);
    // 30 bản gần nhất luôn được giữ.
    expect(recent.some((n) => pruned.has(n))).toBe(false);
  });

  it('không bao giờ xóa file có tên không đúng mẫu', () => {
    const names = [...Array.from({ length: 35 }, (_, i) => name(2024, 1, 1, 0, i)), 'ghi-chu.txt'];
    expect(snapshotsToPrune(names, NOW)).not.toContain('ghi-chu.txt');
  });
});
