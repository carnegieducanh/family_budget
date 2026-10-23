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
});
