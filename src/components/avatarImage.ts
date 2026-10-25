import { DomainError } from '../core/errors';

/** Cạnh ảnh đại diện sau khi thu nhỏ: đủ nét cho ô 64 px trên màn hình 2x. */
const AVATAR_PX = 128;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Ảnh người dùng chọn → ảnh vuông 128 px (cắt phần giữa) dạng data URL JPEG, chỉ vài KB nên
 * lưu thẳng vào dữ liệu sync được. Đọc qua data URL vì CSP của app chỉ cho `img-src data:`.
 */
export async function imageFileToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new DomainError('Hãy chọn một file ảnh (JPG, PNG...).');
  }
  const image = new Image();
  image.src = await readAsDataUrl(file);
  try {
    await image.decode();
  } catch {
    throw new DomainError('Không mở được ảnh này. Hãy chọn ảnh JPG hoặc PNG.');
  }

  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const context = canvas.getContext('2d');
  if (!context) throw new DomainError('Không xử lý được ảnh.');
  // JPEG không có nền trong suốt: phần trong suốt của ảnh PNG thành màu trắng.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, AVATAR_PX, AVATAR_PX);
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_PX,
    AVATAR_PX,
  );
  return canvas.toDataURL('image/jpeg', 0.85);
}
