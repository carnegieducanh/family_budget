import { useSyncExternalStore } from 'react';

// Các modal đang mở, modal mở sau nằm cuối. Esc chỉ đóng modal trên cùng
// (ví dụ hộp xác nhận xóa nằm trên modal sửa khoản chi).
export const openModals: string[] = [];

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function pushModal(id: string): void {
  openModals.push(id);
  notify();
}

export function removeModal(id: string): void {
  openModals.splice(openModals.indexOf(id), 1);
  notify();
}

/** Có modal nào đang mở không (dùng để tắt phím tắt toàn cục). */
export function isAnyModalOpen(): boolean {
  return openModals.length > 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Số modal đang mở, cập nhật khi mở hoặc đóng modal (để popup tự động chờ đến lượt). */
export function useOpenModalCount(): number {
  return useSyncExternalStore(subscribe, () => openModals.length);
}
