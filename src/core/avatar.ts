import { DomainError } from './errors';

// Ảnh đại diện của người dùng (User.avatar): ảnh vuông đã thu nhỏ lưu thẳng trong dữ liệu
// dạng data URL, hoặc một emoji. Ảnh nằm trong file sync nên phải nhỏ (vài KB).

/** Emoji gợi ý khi chưa muốn dùng ảnh: 3 hàng 8 ô như trong bảng chọn. */
// prettier-ignore
export const AVATAR_EMOJIS = [
  '👨', '👩', '🧑', '👦', '👧', '🧔', '👴', '👵',
  '🐻', '🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🐯',
  '🐸', '🐧', '🐥', '🐳', '🌸', '🌻', '🍀', '⭐',
] as const;

/** Giới hạn độ dài data URL (ảnh 128 px thực tế chỉ khoảng 10 KB). */
export const MAX_AVATAR_LENGTH = 150_000;

const IMAGE_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

export type AvatarView =
  { kind: 'image'; src: string } | { kind: 'emoji'; emoji: string } | { kind: 'initial' };

/**
 * Cách hiển thị một giá trị avatar. Dữ liệu đọc từ máy kia không đi qua `checkAvatar`, nên
 * giá trị lạ (không phải ảnh hay emoji hợp lệ) thì hiện chữ cái đầu như khi chưa có avatar.
 */
export function viewAvatar(avatar: string | undefined): AvatarView {
  if (!avatar) return { kind: 'initial' };
  if (avatar.startsWith('data:')) {
    return avatar.length <= MAX_AVATAR_LENGTH && IMAGE_RE.test(avatar)
      ? { kind: 'image', src: avatar }
      : { kind: 'initial' };
  }
  return avatar.length <= 16 && !/\s/.test(avatar) && EMOJI_RE.test(avatar)
    ? { kind: 'emoji', emoji: avatar }
    : { kind: 'initial' };
}

/** Kiểm tra avatar trước khi lưu; trả về giá trị đã chuẩn hóa. */
export function checkAvatar(avatar: string): string {
  const value = avatar.trim();
  const view = viewAvatar(value);
  if (view.kind !== 'initial') return value;
  if (value.startsWith('data:')) {
    throw new DomainError(
      value.length > MAX_AVATAR_LENGTH ? 'Ảnh đại diện quá lớn.' : 'Ảnh đại diện không hợp lệ.',
    );
  }
  throw new DomainError('Hãy chọn một ảnh hoặc một emoji làm ảnh đại diện.');
}
