import { categoryKey } from './categories';
import { DomainError } from './errors';
import { parseYen } from './money';
import { isValidDate, monthOfDate } from './month';
import { sortTransactions } from './queries';
import { active, createRecord } from './records';
import { validateTransactionInput } from './transactions';
import type { DataFile, MutationContext, Transaction, TransactionInput } from './types';

// Export và import CSV (SPEC mục 8): cột `date,amount,category,note,paidBy,createdBy`, tên
// danh mục và tên người thay cho id, UTF-8 có BOM để Excel mở đúng tiếng Việt.

export const CSV_COLUMNS = ['date', 'amount', 'category', 'note', 'paidBy', 'createdBy'] as const;
const BOM = '﻿';

// Ô bắt đầu bằng các ký tự này bị Excel hiểu là công thức. Khi export thêm dấu ' phía
// trước (Excel ẩn dấu này), khi import thì bỏ đi.
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeField(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",;\r\n]/.test(safe) || safe !== safe.trim() ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function unescapeText(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

/** Các khoản chi (bỏ khoản đã xóa) từ tháng `fromMonth` đến `toMonth`, cũ nhất trước. */
export function transactionsForExport(
  data: DataFile,
  fromMonth: string,
  toMonth: string,
): Transaction[] {
  const inRange = data.transactions.filter((tx) => {
    const month = monthOfDate(tx.date);
    return !tx.deleted && month >= fromMonth && month <= toMonth;
  });
  return sortTransactions(inRange, 'date-asc');
}

/** Nội dung file CSV của các khoản chi từ tháng `fromMonth` đến `toMonth`. */
export function exportCsv(data: DataFile, fromMonth: string, toMonth: string): string {
  const categories = new Map(data.categories.map((c) => [c.id, c.name]));
  const users = new Map(data.users.map((u) => [u.id, u.name]));
  const lines = transactionsForExport(data, fromMonth, toMonth).map((tx) =>
    [
      tx.date,
      String(tx.amount),
      categories.get(tx.categoryId) ?? '',
      tx.note,
      users.get(tx.paidBy) ?? '',
      users.get(tx.createdBy) ?? '',
    ]
      .map(escapeField)
      .join(','),
  );
  return BOM + [CSV_COLUMNS.join(','), ...lines].join('\r\n') + '\r\n';
}

export interface CsvRow {
  /** Số dòng trong file (tính từ 1), để báo lỗi. */
  line: number;
  fields: string[];
}

/**
 * Đọc CSV theo RFC 4180: ô trong ngoặc kép có thể chứa dấu phẩy, xuống dòng và `""`.
 * Nhận cả dấu `;` hoặc tab làm dấu phân cách (Excel lưu theo cài đặt vùng của máy).
 */
export function parseCsv(text: string): CsvRow[] {
  const input = text.startsWith(BOM) ? text.slice(1) : text;
  const header = input.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = header.includes(',')
    ? ','
    : header.includes(';')
      ? ';'
      : header.includes('\t')
        ? '\t'
        : ',';

  const rows: CsvRow[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;

  const endRow = () => {
    fields.push(field);
    rows.push({ line: rowLine, fields });
    fields = [];
    field = '';
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      fields.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      field += ch;
    }
  }
  if (field !== '' || fields.length > 0) endRow();
  return rows.filter((row) => row.fields.some((f) => f.trim() !== ''));
}

export type ImportRow =
  | { line: number; status: 'new' | 'duplicate'; input: TransactionInput; createdBy: string }
  | { line: number; status: 'error'; message: string };

export interface ImportPreview {
  rows: ImportRow[];
  newCount: number;
  duplicateCount: number;
  errorCount: number;
}

const REQUIRED_COLUMNS = ['date', 'amount', 'category', 'paidby'];

/** "2026-10-05", "2026/10/5" → "2026-10-05"; null nếu không hợp lệ. */
function normalizeDate(value: string): string | null {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value);
  if (!match) return null;
  const date = `${match[1]}-${match[2]?.padStart(2, '0')}-${match[3]?.padStart(2, '0')}`;
  return isValidDate(date) ? date : null;
}

function duplicateKey(input: TransactionInput): string {
  return [input.date, input.amount, input.categoryId, input.note].join('\u0000');
}

/**
 * Kiểm tra file CSV trước khi nhập: mỗi dòng là khoản mới, trùng (cùng ngày, số tiền,
 * danh mục, ghi chú với một khoản đã có hoặc một dòng trước đó, sẽ bỏ qua) hoặc lỗi.
 * Ném DomainError nếu cả file không dùng được (rỗng, thiếu cột).
 */
export function prepareImport(text: string, ctx: MutationContext): ImportPreview {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new DomainError('File CSV rỗng.');
  const columns = header.fields.map((name) => name.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((name) => !columns.includes(name));
  if (missing.length > 0) {
    throw new DomainError(
      `File CSV thiếu cột ${missing.join(', ')}. Dòng đầu phải là: ${CSV_COLUMNS.join(',')}`,
    );
  }

  const { data } = ctx;
  const categories = active(data.categories);
  const users = active(data.users);
  const findUser = (name: string) =>
    users.find((u) => u.name.trim().toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'));
  const seen = new Set(active(data.transactions).map(duplicateKey));

  const rows = body.map((row): ImportRow => {
    const get = (name: string) => {
      const index = columns.indexOf(name);
      return index === -1 ? '' : unescapeText((row.fields[index] ?? '').trim());
    };
    const fail = (message: string): ImportRow => ({ line: row.line, status: 'error', message });

    const date = normalizeDate(get('date'));
    if (!date) return fail(`Ngày không hợp lệ "${get('date')}" (cần dạng YYYY-MM-DD).`);
    const amount = parseYen(get('amount'));
    if (amount === null) return fail(`Số tiền không hợp lệ "${get('amount')}".`);
    const category = categories.find((c) => categoryKey(c.name) === categoryKey(get('category')));
    if (!category) return fail(`Không có danh mục "${get('category')}".`);
    const paidBy = findUser(get('paidby'));
    if (!paidBy) return fail(`Không có người dùng "${get('paidby')}" (cột paidBy).`);
    const createdByName = get('createdby');
    const createdBy = createdByName
      ? findUser(createdByName)
      : users.find((u) => u.id === ctx.userId);
    if (!createdBy) return fail(`Không có người dùng "${createdByName}" (cột createdBy).`);

    let input: TransactionInput;
    try {
      input = validateTransactionInput(
        { date, amount, categoryId: category.id, note: get('note'), paidBy: paidBy.id },
        data,
      );
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }

    const key = duplicateKey(input);
    if (seen.has(key))
      return { line: row.line, status: 'duplicate', input, createdBy: createdBy.id };
    seen.add(key);
    return { line: row.line, status: 'new', input, createdBy: createdBy.id };
  });

  return {
    rows,
    newCount: rows.filter((r) => r.status === 'new').length,
    duplicateCount: rows.filter((r) => r.status === 'duplicate').length,
    errorCount: rows.filter((r) => r.status === 'error').length,
  };
}

/** Các khoản chi mới từ những dòng hợp lệ, không trùng. Người nhập lấy theo cột createdBy. */
export function importTransactions(
  preview: ImportPreview,
  ctx: MutationContext,
  newId: () => string,
): Transaction[] {
  return preview.rows.flatMap((row) => {
    if (row.status !== 'new') return [];
    return [
      createRecord<Transaction>(
        newId(),
        { ...row.input, createdBy: row.createdBy },
        ctx.userId,
        ctx.now,
      ),
    ];
  });
}
