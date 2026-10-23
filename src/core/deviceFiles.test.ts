import { describe, expect, it } from 'vitest';
import { deviceFileName, parseDeviceFileName } from './deviceFiles';

const ID = '3f2b8c1e-7a4d-4e8b-9c1f-2d6e5a7b8c9d';

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
