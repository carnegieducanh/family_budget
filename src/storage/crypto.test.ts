import { beforeAll, describe, expect, it } from 'vitest';
import { parseDataFile, serializeDataFile } from '../core/dataFile';
import { makeData, makeTx } from '../core/testing';
import {
  DecryptError,
  InvalidEnvelopeError,
  KDF_ITERATIONS,
  NO_ENCRYPTED_FILE_MESSAGE,
  WRONG_PASSWORD_MESSAGE,
  base64ToBytes,
  bytesToBase64,
  checkNewPassword,
  createFileKey,
  decryptFile,
  encryptFile,
  exportFileKey,
  fileKeyFromPassword,
  importFileKey,
  type FileKey,
} from './crypto';

const PASSWORD = 'mật khẩu chung 2026';

function sampleJson(): string {
  const { data, a } = makeData();
  return serializeDataFile({
    ...data,
    transactions: [
      makeTx({
        id: 'tx-1',
        date: '2026-10-05',
        amount: 12500,
        paidBy: a,
        note: 'Tiền điện tháng 10',
      }),
    ],
  });
}

// PBKDF2 600,000 vòng mất vài trăm ms mỗi lần, nên chỉ dẫn xuất khóa một lần cho cả file test.
let adminKey: FileKey;
beforeAll(async () => {
  adminKey = await createFileKey(PASSWORD);
});

describe('encryptFile / decryptFile', () => {
  it('mã hóa rồi giải mã ra đúng dữ liệu', async () => {
    const json = sampleJson();
    const encrypted = await encryptFile(json, adminKey);
    expect(await decryptFile(encrypted, adminKey)).toBe(json);
    expect(parseDataFile(await decryptFile(encrypted, adminKey))).toEqual(parseDataFile(json));
  });

  it('file mã hóa đúng định dạng của SPEC và không lộ nội dung', async () => {
    const encrypted = await encryptFile(sampleJson(), adminKey);
    const envelope = JSON.parse(encrypted);
    expect(Object.keys(envelope).sort()).toEqual(['alg', 'data', 'iter', 'iv', 'kdf', 'salt', 'v']);
    expect(envelope).toMatchObject({
      v: 1,
      alg: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iter: 600_000,
      salt: adminKey.saltB64,
    });
    expect(base64ToBytes(envelope.salt)).toHaveLength(16);
    expect(base64ToBytes(envelope.iv)).toHaveLength(12);
    expect(encrypted).not.toContain('Tiền điện');
    expect(encrypted).not.toContain('12500');
  });

  it('mỗi lần ghi dùng một IV mới', async () => {
    const json = sampleJson();
    const first = JSON.parse(await encryptFile(json, adminKey));
    const second = JSON.parse(await encryptFile(json, adminKey));
    expect(first.salt).toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.data).not.toBe(second.data);
  });

  it('bản mã bị sửa → DecryptError, không trả về dữ liệu sai', async () => {
    const envelope = JSON.parse(await encryptFile(sampleJson(), adminKey));
    const bytes = base64ToBytes(envelope.data);
    bytes[10] = (bytes[10] as number) ^ 0xff;
    const tampered = JSON.stringify({ ...envelope, data: bytesToBase64(bytes) });
    await expect(decryptFile(tampered, adminKey)).rejects.toBeInstanceOf(DecryptError);
  });

  it('khóa xuất ra settings.json rồi nhập lại vẫn giải mã được', async () => {
    const stored = await exportFileKey(adminKey);
    expect(base64ToBytes(stored.keyB64)).toHaveLength(32); // AES 256 bit
    const restored = await importFileKey(stored);
    const encrypted = await encryptFile('{"x":1}', restored);
    expect(await decryptFile(encrypted, adminKey)).toBe('{"x":1}');
  });
});

describe('fileKeyFromPassword (máy thứ hai nhập mật khẩu chung)', () => {
  it('đúng mật khẩu → ra cùng khóa với máy admin', async () => {
    const encrypted = await encryptFile(sampleJson(), adminKey);
    const memberKey = await fileKeyFromPassword(PASSWORD, [encrypted]);
    expect(await exportFileKey(memberKey)).toEqual(await exportFileKey(adminKey));
    // Máy thứ hai ghi file, máy admin đọc được.
    const fromMember = await encryptFile('{"from":"member"}', memberKey);
    expect(await decryptFile(fromMember, adminKey)).toBe('{"from":"member"}');
  });

  it('sai mật khẩu → báo lỗi', async () => {
    const encrypted = await encryptFile(sampleJson(), adminKey);
    await expect(fileKeyFromPassword('mật khẩu sai', [encrypted])).rejects.toThrow(
      WRONG_PASSWORD_MESSAGE,
    );
  });

  it('thư mục còn file hỏng hoặc file của mật khẩu cũ → vẫn tìm ra khóa đúng', async () => {
    const old = await encryptFile('{}', await createFileKey('mật khẩu cũ của máy đã cài lại'));
    const current = await encryptFile(sampleJson(), adminKey);
    const key = await fileKeyFromPassword(PASSWORD, ['{"v":1}', old, current]);
    expect(key.saltB64).toBe(adminKey.saltB64);
  });

  it('không có file mã hóa hợp lệ nào → báo chưa thấy file', async () => {
    await expect(fileKeyFromPassword(PASSWORD, ['{"v":1}'])).rejects.toThrow(
      NO_ENCRYPTED_FILE_MESSAGE,
    );
  });

  it('máy kia đã đổi mật khẩu (salt và khóa khác) → không giải mã được', async () => {
    const changed = await createFileKey('mật khẩu mới');
    const encrypted = await encryptFile(sampleJson(), changed);
    await expect(decryptFile(encrypted, adminKey)).rejects.toThrow(
      'Không giải mã được dữ liệu từ máy kia, kiểm tra mật khẩu.',
    );
  });
});

describe('parseEnvelope (qua decryptFile)', () => {
  async function envelope(): Promise<Record<string, unknown>> {
    return JSON.parse(await encryptFile('{}', adminKey));
  }

  it.each([
    ['không phải JSON', async () => '{"v":1,'],
    ['file thường, không mã hóa', async () => sampleJson()],
    ['thuật toán khác', async () => JSON.stringify({ ...(await envelope()), alg: 'AES-CBC' })],
    ['phiên bản khác', async () => JSON.stringify({ ...(await envelope()), v: 2 })],
    ['số vòng khác', async () => JSON.stringify({ ...(await envelope()), iter: 1000 })],
    ['iv không phải base64', async () => JSON.stringify({ ...(await envelope()), iv: '%%%' })],
    ['salt sai độ dài', async () => JSON.stringify({ ...(await envelope()), salt: 'AAAA' })],
    ['thiếu data', async () => JSON.stringify({ ...(await envelope()), data: undefined })],
  ])('%s → InvalidEnvelopeError', async (_label, make) => {
    await expect(decryptFile(await make(), adminKey)).rejects.toBeInstanceOf(InvalidEnvelopeError);
  });

  it('KDF_ITERATIONS đúng như SPEC', () => {
    expect(KDF_ITERATIONS).toBe(600_000);
  });
});

describe('checkNewPassword', () => {
  it('cần ít nhất 8 ký tự và hai lần nhập khớp nhau', () => {
    expect(() => checkNewPassword('1234567', '1234567')).toThrow('ít nhất 8 ký tự');
    expect(() => checkNewPassword('12345678', '12345679')).toThrow('không khớp');
    expect(() => checkNewPassword('12345678', '12345678')).not.toThrow();
  });
});

describe('base64', () => {
  it('chuyển qua lại đúng với dữ liệu lớn', () => {
    const bytes = new Uint8Array(300_000).map((_, i) => (i * 7) % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});
