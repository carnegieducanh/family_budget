import { describe, expect, it } from 'vitest';
import { parseDataFile, parseSettings, serializeDataFile, serializeSettings } from './dataFile';
import { createSettings } from './defaults';
import { SchemaTooNewError } from './migrations';
import { makeData, makeTx } from './testing';

describe('parseDataFile', () => {
  it('đọc lại đúng dữ liệu đã ghi', () => {
    const { data, a } = makeData();
    data.transactions = [makeTx({ date: '2026-10-01', amount: 1000, paidBy: a })];
    expect(parseDataFile(serializeDataFile(data))).toEqual(data);
  });

  it('ảnh đại diện là trường không bắt buộc, nhưng có thì phải là chuỗi', () => {
    const { data } = makeData();
    data.users[0] = { ...data.users[0]!, avatar: '🐻' };
    expect(parseDataFile(serializeDataFile(data)).users[0]?.avatar).toBe('🐻');
    expect(parseDataFile(serializeDataFile(data)).users[1]?.avatar).toBeUndefined();
    const raw = JSON.parse(serializeDataFile(data));
    raw.users[0].avatar = 1;
    expect(() => parseDataFile(JSON.stringify(raw))).toThrow('users[0].avatar');
  });

  it('JSON hỏng → lỗi', () => {
    expect(() => parseDataFile('{"schemaVersion": 1, ')).toThrow('file JSON bị hỏng');
  });

  it('thiếu danh sách → lỗi', () => {
    const { data } = makeData();
    const { transactions, ...rest } = data;
    expect(() => parseDataFile(JSON.stringify(rest))).toThrow('transactions');
  });

  it('bản ghi sai kiểu → lỗi chỉ rõ vị trí', () => {
    const { data, a } = makeData();
    data.transactions = [makeTx({ date: '2026-10-01', amount: 1000, paidBy: a })];
    const raw = JSON.parse(serializeDataFile(data));
    raw.transactions[0].amount = '1000';
    expect(() => parseDataFile(JSON.stringify(raw))).toThrow('transactions[0].amount');
  });

  it('schemaVersion lớn hơn bản app hỗ trợ → SchemaTooNewError', () => {
    const { data } = makeData();
    const raw = { ...data, schemaVersion: 99 };
    expect(() => parseDataFile(JSON.stringify(raw))).toThrow(SchemaTooNewError);
  });

  it('thiếu schemaVersion → lỗi', () => {
    const { data } = makeData();
    const { schemaVersion, ...rest } = data;
    expect(() => parseDataFile(JSON.stringify(rest))).toThrow('schemaVersion');
  });

  it('không phải object → lỗi', () => {
    expect(() => parseDataFile('[]')).toThrow('không phải object');
  });
});

describe('parseSettings', () => {
  it('đọc lại đúng settings đã ghi', () => {
    const settings = { ...createSettings('device-1'), userId: 'user-a' };
    expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  });

  it('điền giá trị mặc định cho trường thiếu', () => {
    expect(parseSettings('{"deviceId":"device-1"}')).toEqual(createSettings('device-1'));
  });

  it('thiếu deviceId → lỗi', () => {
    expect(() => parseSettings('{"userId":"x"}')).toThrow('deviceId');
  });

  it('giữ khóa mã hóa và salt đi kèm', () => {
    const encryption = { enabled: true, keyB64: 'a2V5', saltB64: 'c2FsdA==' };
    const settings = { ...createSettings('device-1'), encryption };
    expect(parseSettings(serializeSettings(settings)).encryption).toEqual(encryption);
    // Đã tắt mã hóa nhưng vẫn giữ khóa để đọc file mã hóa của máy kia.
    const disabled = { ...settings, encryption: { ...encryption, enabled: false } };
    expect(parseSettings(serializeSettings(disabled)).encryption.keyB64).toBe('a2V5');
  });

  it('bật mã hóa mà thiếu khóa hoặc salt → coi như tắt', () => {
    const json = (encryption: object) => JSON.stringify({ deviceId: 'device-1', encryption });
    expect(parseSettings(json({ enabled: true })).encryption).toEqual({ enabled: false });
    expect(parseSettings(json({ enabled: true, keyB64: 'a2V5' })).encryption).toEqual({
      enabled: false,
    });
  });
});
