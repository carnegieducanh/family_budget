// Tên file trong thư mục Drive (SPEC mục 4, 5). Mỗi máy chỉ ghi file của chính mình
// `device-<deviceId>.json` (hoặc `.enc.json` khi bật mã hóa) và chỉ đọc file của máy khác.

/** Thư mục con chứa file của các máy, nằm trong thư mục Drive người dùng chọn. */
export const SYNC_SUBFOLDER = 'FamilyBudget';

// deviceId là UUID nên chỉ gồm chữ, số và dấu gạch. Mẫu này không khớp file tạm
// (`.device-<id>.json.tmp`) và bản sao Drive tự tạo khi xung đột (`device-<id> (1).json`).
const DEVICE_FILE_RE = /^device-([A-Za-z0-9-]+?)(\.enc)?\.json$/;

export interface DeviceFileInfo {
  name: string;
  deviceId: string;
  encrypted: boolean;
}

export function deviceFileName(deviceId: string, encrypted = false): string {
  return `device-${deviceId}${encrypted ? '.enc' : ''}.json`;
}

/** Thông tin từ tên file; null nếu không phải file dữ liệu của một máy. */
export function parseDeviceFileName(name: string): DeviceFileInfo | null {
  const match = DEVICE_FILE_RE.exec(name);
  if (!match?.[1]) return null;
  return { name, deviceId: match[1], encrypted: match[2] !== undefined };
}
