import type { BaseRecord, DataFile } from './types';

// Gộp dữ liệu của 2 máy (SPEC mục 5). Làm riêng cho từng collection: hợp tất cả id,
// id có ở cả hai bên thì giữ nguyên bản có updatedAt lớn hơn (last write wins, so cả
// bản ghi, không gộp từng trường). Bản ghi đã xóa mềm tham gia như bản ghi thường, nên
// khoản đã xóa ở máy này không "sống lại" từ máy kia. Merge không áp luật nghiệp vụ.

export const COLLECTIONS = [
  'users',
  'categories',
  'transactions',
  'budgets',
  'recurring',
  'months',
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

/** Giờ ghi trên một máy được coi là lệch khi vượt giờ máy này quá 5 phút. */
export const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

function timeOf(iso: string): number {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** Nội dung bản ghi dạng chuỗi, không phụ thuộc thứ tự trường (bản ghi chỉ có giá trị đơn). */
function canonical(record: BaseRecord): string {
  return JSON.stringify(record, Object.keys(record).sort());
}

// So sánh chuỗi theo mã ký tự, không dùng localeCompare: kết quả phải giống hệt nhau
// trên Windows và macOS dù ngôn ngữ hệ thống khác nhau.
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * So sánh hai phiên bản của cùng một bản ghi; số dương nghĩa là `a` thắng.
 * updatedAt mới hơn thắng; bằng nhau thì updatedBy đứng trước theo thứ tự chữ cái thắng;
 * vẫn bằng thì so nội dung, để hai máy luôn chọn cùng một bản dù thứ tự gộp khác nhau.
 */
export function compareVersions(a: BaseRecord, b: BaseRecord): number {
  const timeA = timeOf(a.updatedAt);
  const timeB = timeOf(b.updatedAt);
  if (timeA !== timeB) return timeA > timeB ? 1 : -1;
  const by = compareText(a.updatedBy, b.updatedBy);
  if (by !== 0) return -by;
  return -compareText(canonical(a), canonical(b));
}

/** Gộp một collection. Kết quả sắp theo id nên không phụ thuộc bên nào là local. */
export function mergeRecords<T extends BaseRecord>(local: readonly T[], remote: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const record of [...local, ...remote]) {
    const current = byId.get(record.id);
    if (!current || compareVersions(record, current) > 0) byId.set(record.id, record);
  }
  return [...byId.values()].sort((a, b) => compareText(a.id, b.id));
}

/** Gộp toàn bộ dữ liệu. Phần đầu file (schemaVersion, deviceId, writtenAt) giữ của local. */
export function merge(local: DataFile, remote: DataFile): DataFile {
  return {
    ...local,
    users: mergeRecords(local.users, remote.users),
    categories: mergeRecords(local.categories, remote.categories),
    transactions: mergeRecords(local.transactions, remote.transactions),
    budgets: mergeRecords(local.budgets, remote.budgets),
    recurring: mergeRecords(local.recurring, remote.recurring),
    months: mergeRecords(local.months, remote.months),
  };
}

/** Hai phiên bản của một bản ghi có cùng nội dung không (không xét thứ tự trường). */
export function sameRecord(a: BaseRecord, b: BaseRecord): boolean {
  return canonical(a) === canonical(b);
}

function allRecords(data: DataFile): BaseRecord[] {
  return COLLECTIONS.flatMap((name): BaseRecord[] => data[name]);
}

/** Hai bộ dữ liệu có đúng cùng các bản ghi không (không xét thứ tự và phần đầu file). */
export function sameRecords(a: DataFile, b: DataFile): boolean {
  return COLLECTIONS.every((name) => {
    const listA: readonly BaseRecord[] = a[name];
    const listB: readonly BaseRecord[] = b[name];
    if (listA.length !== listB.length) return false;
    const byId = new Map(listB.map((record) => [record.id, canonical(record)]));
    return listA.every((record) => byId.get(record.id) === canonical(record));
  });
}

/**
 * Dữ liệu máy kia có thời điểm ghi vượt giờ máy này quá 5 phút: giờ trên hai máy lệch
 * nhau. Chỉ để cảnh báo, vẫn merge bình thường.
 */
export function hasClockSkew(remote: DataFile, now: Date): boolean {
  const limit = now.getTime() + CLOCK_SKEW_TOLERANCE_MS;
  return (
    timeOf(remote.writtenAt) > limit ||
    allRecords(remote).some((record) => timeOf(record.updatedAt) > limit)
  );
}
