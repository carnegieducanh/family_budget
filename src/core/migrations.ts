import { DomainError } from './errors';

/** Phiên bản cấu trúc dữ liệu mà bản app này đọc và ghi. */
export const SCHEMA_VERSION = 1;

/** Dữ liệu được ghi bởi bản app mới hơn bản đang chạy. */
export class SchemaTooNewError extends DomainError {
  readonly version: number;

  constructor(version: number) {
    super(`Dữ liệu được ghi bởi bản app mới hơn (phiên bản dữ liệu ${version}). Hãy cập nhật app.`);
    this.name = 'SchemaTooNewError';
    this.version = version;
  }
}

/**
 * Hàm nâng cấp từ version N lên N+1, đánh số theo version nguồn.
 * Khi tăng SCHEMA_VERSION, thêm một bước ở đây; không sửa các bước cũ.
 */
const UPGRADES: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

/**
 * Đưa dữ liệu thô (đã JSON.parse) về SCHEMA_VERSION hiện tại.
 * Chỉ đổi version; kiểm tra cấu trúc nằm ở `parseDataFile`.
 */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new DomainError('Dữ liệu không có schemaVersion hợp lệ.');
  }
  if (version > SCHEMA_VERSION) throw new SchemaTooNewError(version);

  let current = raw;
  for (let v = version; v < SCHEMA_VERSION; v++) {
    const upgrade = UPGRADES[v];
    if (!upgrade) throw new DomainError(`Thiếu hàm nâng cấp dữ liệu từ phiên bản ${v}.`);
    current = { ...upgrade(current), schemaVersion: v + 1 };
  }
  return current;
}
