// maximumFractionDigits: 1 chỉ để hiện đúng phần "mỗi người chịu" khi tổng lẻ (¥500.5).
// Số tiền nhập và lưu luôn là số nguyên nên bình thường không có phần thập phân.
const yenFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 1,
});

/** Hiển thị số tiền yên dạng ¥12,500. */
export function formatYen(amount: number): string {
  return yenFormatter.format(amount);
}

/**
 * Số tiền người dùng gõ: "12500", "12,500", "¥12,500", "12500円" → 12500.
 * null nếu không phải số nguyên yên lớn hơn 0.
 */
export function parseYen(text: string): number | null {
  const digits = text.replace(/[¥￥円,\s]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
