import { DomainError } from '../core/errors';

// Mã hóa file của máy trên Drive (SPEC mục 9): AES-GCM 256 bit, khóa dẫn xuất từ mật khẩu
// chung bằng PBKDF2-SHA256. Chỉ file `device-<id>.enc.json` trên Drive được mã hóa; data.json
// và settings.json trên máy giữ dạng thường. Chỉ dùng Web Crypto API (có sẵn trong WebView
// và Node), không phụ thuộc Tauri.
//
// Hai máy phải có cùng một khóa, mà máy chỉ lưu khóa đã dẫn xuất (không lưu mật khẩu), nên
// cả hai dùng chung một salt: admin tạo salt ngẫu nhiên khi đặt mật khẩu, máy kia lấy salt từ
// file mã hóa của máy admin rồi dẫn xuất lại khóa từ mật khẩu nhập vào.

export const KDF_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** Nội dung file `device-<id>.enc.json`. */
export interface EncryptedEnvelope {
  v: 1;
  alg: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64, bản mã kèm tag xác thực
}

/** Khóa AES đã dẫn xuất, kèm salt đã dùng để dẫn xuất (ghi vào mỗi file mã hóa). */
export interface FileKey {
  key: CryptoKey;
  saltB64: string;
}

/** Khóa dạng lưu trong settings.json. */
export interface StoredKey {
  keyB64: string;
  saltB64: string;
}

/** Nội dung không phải file mã hóa hợp lệ. */
export class InvalidEnvelopeError extends DomainError {
  constructor(detail: string) {
    super(`File mã hóa sai cấu trúc: ${detail}.`);
    this.name = 'InvalidEnvelopeError';
  }
}

/** Sai khóa (sai mật khẩu, hoặc máy kia đã đổi mật khẩu) hoặc bản mã bị sửa. */
export class DecryptError extends DomainError {
  constructor() {
    super('Không giải mã được dữ liệu từ máy kia, kiểm tra mật khẩu.');
    this.name = 'DecryptError';
  }
}

export const WRONG_PASSWORD_MESSAGE = 'Sai mật khẩu: không giải mã được dữ liệu của máy kia.';

// btoa/atob làm việc với chuỗi "binary"; chia nhỏ để không vượt giới hạn tham số khi
// file dữ liệu lớn (vài trăm KB).
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeField(envelope: Record<string, unknown>, field: string): Uint8Array<ArrayBuffer> {
  const value = envelope[field];
  if (typeof value !== 'string' || value === '') throw new InvalidEnvelopeError(`thiếu ${field}`);
  try {
    return base64ToBytes(value);
  } catch {
    throw new InvalidEnvelopeError(`${field} không phải base64`);
  }
}

interface ParsedEnvelope {
  saltB64: string;
  iv: Uint8Array<ArrayBuffer>;
  data: Uint8Array<ArrayBuffer>;
}

/** Đọc và kiểm tra cấu trúc file mã hóa. */
export function parseEnvelope(json: string): ParsedEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new InvalidEnvelopeError('không phải JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidEnvelopeError('không phải object JSON');
  }
  const envelope = raw as Record<string, unknown>;
  if (envelope.v !== 1 || envelope.alg !== 'AES-GCM' || envelope.kdf !== 'PBKDF2-SHA256') {
    throw new InvalidEnvelopeError('phiên bản hoặc thuật toán không hỗ trợ');
  }
  // Khóa lưu trên máy không kèm số vòng, nên mọi máy phải dẫn xuất với cùng một số vòng.
  if (envelope.iter !== KDF_ITERATIONS) {
    throw new InvalidEnvelopeError('số vòng PBKDF2 không hỗ trợ');
  }
  const salt = decodeField(envelope, 'salt');
  const iv = decodeField(envelope, 'iv');
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) {
    throw new InvalidEnvelopeError('độ dài salt hoặc iv không đúng');
  }
  return { saltB64: bytesToBase64(salt), iv, data: decodeField(envelope, 'data') };
}

/** Dẫn xuất khóa AES-GCM 256 bit từ mật khẩu và salt. */
export async function deriveFileKey(password: string, saltB64: string): Promise<FileKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltB64), iterations: KDF_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    true, // xuất ra được để lưu vào settings.json
    ['encrypt', 'decrypt'],
  );
  return { key, saltB64 };
}

/** Khóa mới với salt ngẫu nhiên: admin đặt hoặc đổi mật khẩu. */
export function createFileKey(password: string): Promise<FileKey> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return deriveFileKey(password, bytesToBase64(salt));
}

export async function exportFileKey(fileKey: FileKey): Promise<StoredKey> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', fileKey.key));
  return { keyB64: bytesToBase64(raw), saltB64: fileKey.saltB64 };
}

export async function importFileKey(stored: StoredKey): Promise<FileKey> {
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(stored.keyB64),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
  return { key, saltB64: stored.saltB64 };
}

/** Mã hóa nội dung file của máy này; mỗi lần ghi dùng một IV ngẫu nhiên mới. */
export async function encryptFile(plain: string, fileKey: FileKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    fileKey.key,
    new TextEncoder().encode(plain),
  );
  const envelope: EncryptedEnvelope = {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iter: KDF_ITERATIONS,
    salt: fileKey.saltB64,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(data)),
  };
  return JSON.stringify(envelope);
}

/**
 * Giải mã file của máy khác. Ném InvalidEnvelopeError nếu sai cấu trúc, DecryptError nếu
 * sai khóa (kể cả khi máy kia dùng salt khác, tức là mật khẩu khác) hoặc file bị sửa.
 */
export async function decryptFile(json: string, fileKey: FileKey): Promise<string> {
  const { iv, data } = parseEnvelope(json);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, fileKey.key, data);
  } catch {
    throw new DecryptError();
  }
  return new TextDecoder().decode(plain);
}

export const NO_ENCRYPTED_FILE_MESSAGE =
  'Chưa thấy file mã hóa của máy kia trong thư mục Drive. Hãy chờ Google Drive đồng bộ xong rồi thử lại.';

/**
 * Máy thứ hai nhập mật khẩu chung: dẫn xuất khóa bằng salt ghi trong các file mã hóa của máy
 * kia (thường chỉ có một), rồi thử giải mã. Trả về khóa giải mã được ít nhất một file.
 * Ném DomainError nếu không có file mã hóa hợp lệ nào, hoặc sai mật khẩu.
 */
export async function fileKeyFromPassword(
  password: string,
  envelopes: readonly string[],
): Promise<FileKey> {
  // Mỗi salt (mỗi lần admin đặt mật khẩu) chỉ dẫn xuất một lần: PBKDF2 khá chậm.
  const bySalt = new Map<string, string>();
  for (const json of envelopes) {
    try {
      const { saltB64 } = parseEnvelope(json);
      if (!bySalt.has(saltB64)) bySalt.set(saltB64, json);
    } catch {
      // File hỏng: lượt sync sẽ báo riêng.
    }
  }
  if (bySalt.size === 0) throw new DomainError(NO_ENCRYPTED_FILE_MESSAGE);

  for (const [saltB64, json] of bySalt) {
    const fileKey = await deriveFileKey(password, saltB64);
    try {
      await decryptFile(json, fileKey);
      return fileKey;
    } catch (error) {
      if (!(error instanceof DecryptError)) throw error;
    }
  }
  throw new DomainError(WRONG_PASSWORD_MESSAGE);
}

export const MIN_PASSWORD_LENGTH = 8;

/** Mật khẩu mới do admin đặt; ném DomainError nếu không hợp lệ. */
export function checkNewPassword(password: string, confirm: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new DomainError(`Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }
  if (password !== confirm) throw new DomainError('Hai lần nhập mật khẩu không khớp.');
}
