import { DEFAULT_SYNC_INTERVAL_MIN } from './defaults';
import { DomainError } from './errors';
import { migrate } from './migrations';
import type { DataFile, Settings } from './types';

// Đọc và kiểm tra cấu trúc file JSON. Dữ liệu sai cấu trúc bị từ chối nguyên file,
// không bao giờ được dùng để ghi đè dữ liệu đang có (SPEC mục 5, bước 3).

type Json = Record<string, unknown>;
type FieldCheck = [field: string, type: 'string' | 'number' | 'boolean', optional?: boolean];

const BASE_FIELDS: FieldCheck[] = [
  ['id', 'string'],
  ['createdAt', 'string'],
  ['updatedAt', 'string'],
  ['updatedBy', 'string'],
  ['deleted', 'boolean'],
  ['deletedAt', 'string', true],
];

const COLLECTION_FIELDS: Record<string, FieldCheck[]> = {
  users: [
    ['name', 'string'],
    ['role', 'string'],
    ['color', 'string'],
    ['avatar', 'string', true],
  ],
  categories: [
    ['name', 'string'],
    ['icon', 'string'],
    ['order', 'number'],
    ['hidden', 'boolean'],
  ],
  transactions: [
    ['date', 'string'],
    ['amount', 'number'],
    ['categoryId', 'string'],
    ['note', 'string'],
    ['paidBy', 'string'],
    ['createdBy', 'string'],
    ['recurringId', 'string', true],
  ],
  budgets: [
    ['month', 'string'],
    ['amount', 'number'],
  ],
  recurring: [
    ['name', 'string'],
    ['amount', 'number'],
    ['categoryId', 'string'],
    ['paidBy', 'string'],
    ['dayOfMonth', 'number'],
    ['startMonth', 'string'],
    ['active', 'boolean'],
  ],
  months: [
    ['month', 'string'],
    ['manualUnlockUntil', 'string', true],
    ['settledAt', 'string', true],
    ['settledBy', 'string', true],
    ['settledAmount', 'number', true],
    ['settledPayer', 'string', true],
  ],
};

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkFields(record: Json, checks: FieldCheck[], where: string): void {
  for (const [field, type, optional] of checks) {
    const value = record[field];
    if (value === undefined && optional) continue;
    if (typeof value !== type) {
      throw new DomainError(`Dữ liệu sai cấu trúc: ${where}.${field} phải là ${type}.`);
    }
  }
}

function checkDataFile(raw: Json): DataFile {
  if (typeof raw.deviceId !== 'string' || typeof raw.writtenAt !== 'string') {
    throw new DomainError('Dữ liệu sai cấu trúc: thiếu deviceId hoặc writtenAt.');
  }
  for (const [collection, checks] of Object.entries(COLLECTION_FIELDS)) {
    const list = raw[collection];
    if (!Array.isArray(list)) {
      throw new DomainError(`Dữ liệu sai cấu trúc: thiếu danh sách ${collection}.`);
    }
    list.forEach((record: unknown, index) => {
      const where = `${collection}[${index}]`;
      if (!isObject(record)) throw new DomainError(`Dữ liệu sai cấu trúc: ${where}.`);
      checkFields(record, BASE_FIELDS, where);
      checkFields(record, checks, where);
    });
  }
  // Budget.categoryId có thể là null nên kiểm tra riêng.
  (raw.budgets as Json[]).forEach((budget, index) => {
    if (budget.categoryId !== null && typeof budget.categoryId !== 'string') {
      throw new DomainError(`Dữ liệu sai cấu trúc: budgets[${index}].categoryId.`);
    }
  });
  return raw as unknown as DataFile;
}

/** Parse nội dung `data.json` hoặc file `device-*.json`, nâng cấp version nếu cần. */
export function parseDataFile(json: string): DataFile {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new DomainError('Không đọc được dữ liệu: file JSON bị hỏng.');
  }
  if (!isObject(raw)) throw new DomainError('Dữ liệu sai cấu trúc: không phải object JSON.');
  return checkDataFile(migrate(raw));
}

export function serializeDataFile(data: DataFile): string {
  return JSON.stringify(data, null, 2);
}

/** Parse `settings.json`; trường thiếu được điền giá trị mặc định. */
export function parseSettings(json: string): Settings {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new DomainError('Không đọc được settings.json: file JSON bị hỏng.');
  }
  if (!isObject(raw) || typeof raw.deviceId !== 'string' || raw.deviceId === '') {
    throw new DomainError('settings.json sai cấu trúc: thiếu deviceId.');
  }
  const encryption = isObject(raw.encryption) ? raw.encryption : {};
  const key =
    typeof encryption.keyB64 === 'string' && typeof encryption.saltB64 === 'string'
      ? { keyB64: encryption.keyB64, saltB64: encryption.saltB64 }
      : null;
  return {
    deviceId: raw.deviceId,
    userId: typeof raw.userId === 'string' ? raw.userId : null,
    syncFolder: typeof raw.syncFolder === 'string' ? raw.syncFolder : null,
    syncIntervalMin:
      typeof raw.syncIntervalMin === 'number' && raw.syncIntervalMin > 0
        ? raw.syncIntervalMin
        : DEFAULT_SYNC_INTERVAL_MIN,
    // Không có khóa thì không ghi mã hóa được, dù file ghi `enabled: true`.
    encryption: { enabled: encryption.enabled === true && key !== null, ...key },
    ...(typeof raw.lastSyncAt === 'string' ? { lastSyncAt: raw.lastSyncAt } : {}),
  };
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings, null, 2);
}
