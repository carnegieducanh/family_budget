import { describe, expect, it } from 'vitest';
import { changelogSection, releaseNoteItems } from './changelog';

const CHANGELOG = `# Ghi chú phát hành

Mỗi phiên bản một mục.

## 0.2.0

- Giao diện mới.
- Ảnh đại diện.

## 0.1.0

- Bản đầu tiên.
`;

describe('changelogSection', () => {
  it('lấy nội dung mục của phiên bản, tới mục kế tiếp', () => {
    expect(changelogSection(CHANGELOG, '0.2.0')).toBe('- Giao diện mới.\n- Ảnh đại diện.');
  });

  it('mục cuối file lấy tới hết file', () => {
    expect(changelogSection(CHANGELOG, '0.1.0')).toBe('- Bản đầu tiên.');
  });

  it('không có mục, hoặc chỉ khớp một phần số phiên bản, thì trả về null', () => {
    expect(changelogSection(CHANGELOG, '0.3.0')).toBeNull();
    expect(changelogSection(CHANGELOG, '0.2')).toBeNull();
  });

  it('đọc được file xuống dòng kiểu Windows', () => {
    expect(changelogSection(CHANGELOG.replace(/\n/g, '\r\n'), '0.1.0')).toBe('- Bản đầu tiên.');
  });
});

describe('releaseNoteItems', () => {
  it('bỏ dấu đầu dòng và dòng trống', () => {
    expect(releaseNoteItems('- Một.\n\n* Hai.\n  - Ba.\nBốn.')).toEqual([
      'Một.',
      'Hai.',
      'Ba.',
      'Bốn.',
    ]);
  });
});
