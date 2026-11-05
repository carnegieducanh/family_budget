import { describe, expect, it } from 'vitest';
import {
  deviceFileName,
  holdsDeviceFiles,
  isSyncSubfolderName,
  parseDeviceFileName,
} from './deviceFiles';

const ID = '3f2b8c1e-7a4d-4e8b-9c1f-2d6e5a7b8c9d';

const file = (name: string) => ({ name, isDirectory: false });
const dir = (name: string) => ({ name, isDirectory: true });

describe('isSyncSubfolderName', () => {
  it('khớp FamilyBudget, không phân biệt hoa thường', () => {
    expect(isSyncSubfolderName('FamilyBudget')).toBe(true);
    expect(isSyncSubfolderName('familybudget')).toBe(true);
    expect(isSyncSubfolderName('FamilyBudget (1)')).toBe(false);
    expect(isSyncSubfolderName('Family Budget')).toBe(false);
  });
});

describe('holdsDeviceFiles', () => {
  it('thư mục có sẵn file của máy (ví dụ "FamilyBudget (1)") → dùng luôn thư mục đó', () => {
    expect(holdsDeviceFiles([file(`device-${ID}.json`), file('desktop.ini')])).toBe(true);
    expect(holdsDeviceFiles([file(`device-${ID}.enc.json`)])).toBe(true);
  });

  it('đã có thư mục con FamilyBudget → vẫn dùng thư mục con', () => {
    expect(holdsDeviceFiles([dir('FamilyBudget'), file(`device-${ID}.json`)])).toBe(false);
    expect(holdsDeviceFiles([dir('familybudget')])).toBe(false);
  });

  it('thư mục trống hoặc chỉ có file khác → tạo thư mục con', () => {
    expect(holdsDeviceFiles([])).toBe(false);
    expect(holdsDeviceFiles([file('desktop.ini'), dir('Ảnh')])).toBe(false);
    expect(holdsDeviceFiles([file(`.device-${ID}.json.tmp`)])).toBe(false);
    expect(holdsDeviceFiles([dir(`device-${ID}.json`)])).toBe(false);
  });
});

describe('deviceFileName / parseDeviceFileName', () => {
  it('tên file thường và file mã hóa', () => {
    expect(deviceFileName(ID)).toBe(`device-${ID}.json`);
    expect(deviceFileName(ID, true)).toBe(`device-${ID}.enc.json`);
    expect(parseDeviceFileName(`device-${ID}.json`)).toEqual({
      name: `device-${ID}.json`,
      deviceId: ID,
      encrypted: false,
    });
    expect(parseDeviceFileName(`device-${ID}.enc.json`)).toMatchObject({
      deviceId: ID,
      encrypted: true,
    });
  });

  it.each([
    [`.device-${ID}.json.tmp`, 'file tạm'],
    [`device-${ID} (1).json`, 'bản sao Drive tạo khi xung đột'],
    ['data.json', 'file khác'],
    ['device-.json', 'thiếu deviceId'],
    [`device-${ID}.json.bak`, 'đuôi khác'],
  ])('bỏ qua %s (%s)', (name) => {
    expect(parseDeviceFileName(name)).toBeNull();
  });
});
