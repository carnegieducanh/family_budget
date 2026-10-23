// Các modal đang mở, modal mở sau nằm cuối. Esc chỉ đóng modal trên cùng
// (ví dụ hộp xác nhận xóa nằm trên modal sửa khoản chi).
export const openModals: string[] = [];

/** Có modal nào đang mở không (dùng để tắt phím tắt toàn cục). */
export function isAnyModalOpen(): boolean {
  return openModals.length > 0;
}
