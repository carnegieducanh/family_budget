import { useEffect, useState } from 'react';

/**
 * Thời điểm hiện tại, tự cập nhật mỗi 30 giây, để những gì phụ thuộc giờ (sang tháng mới,
 * "5 phút trước") hiện đúng mà không cần thao tác gì.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
