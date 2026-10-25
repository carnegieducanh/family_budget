import { describe, expect, it } from 'vitest';
import { AVATAR_EMOJIS, MAX_AVATAR_LENGTH, checkAvatar, viewAvatar } from './avatar';

const IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

describe('viewAvatar', () => {
  it('ảnh, emoji, hoặc chữ cái đầu khi chưa có', () => {
    expect(viewAvatar(IMAGE)).toEqual({ kind: 'image', src: IMAGE });
    expect(viewAvatar('🐻')).toEqual({ kind: 'emoji', emoji: '🐻' });
    expect(viewAvatar('👨‍👩‍👧')).toEqual({ kind: 'emoji', emoji: '👨‍👩‍👧' });
    expect(viewAvatar(undefined)).toEqual({ kind: 'initial' });
    expect(viewAvatar('')).toEqual({ kind: 'initial' });
  });

  it('mọi emoji gợi ý đều hiển thị được', () => {
    for (const emoji of AVATAR_EMOJIS) expect(viewAvatar(emoji).kind).toBe('emoji');
  });

  it('giá trị lạ từ máy kia → chữ cái đầu, không đưa vào <img>', () => {
    expect(viewAvatar('javascript:alert(1)').kind).toBe('initial');
    expect(viewAvatar('data:text/html;base64,PHNjcmlwdD4=').kind).toBe('initial');
    expect(viewAvatar('data:image/svg+xml;base64,PHN2Zz4=').kind).toBe('initial');
    expect(viewAvatar('https://example.com/a.png').kind).toBe('initial');
    expect(viewAvatar('A').kind).toBe('initial');
    expect(viewAvatar('🐻 🐱').kind).toBe('initial');
  });
});

describe('checkAvatar', () => {
  it('nhận ảnh và emoji, bỏ khoảng trắng thừa', () => {
    expect(checkAvatar(IMAGE)).toBe(IMAGE);
    expect(checkAvatar(' 🐻 ')).toBe('🐻');
  });

  it('từ chối ảnh quá lớn, ảnh sai định dạng, chữ thường', () => {
    const big = `data:image/jpeg;base64,${'A'.repeat(MAX_AVATAR_LENGTH)}`;
    expect(() => checkAvatar(big)).toThrow('quá lớn');
    expect(() => checkAvatar('data:image/gif;base64,R0lGOD==')).toThrow('không hợp lệ');
    expect(() => checkAvatar('Huy')).toThrow('emoji');
    expect(() => checkAvatar('')).toThrow('emoji');
  });
});
