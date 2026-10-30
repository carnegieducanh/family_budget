import Lenis from 'lenis';
import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Cuộn mượt (Lenis) cho một vùng có thanh cuộn dọc riêng: vùng nội dung, sidebar, thân popup...
 * App không cuộn cả cửa sổ nên mỗi vùng một instance; vùng lồng nhau cuộn hết thì phần còn lại
 * chuyền ra vùng ngoài như cuộn gốc. Bàn phím, kéo thanh cuộn, cuộn ngang vẫn là cuộn gốc.
 *
 * Trả về callback ref để gắn vào vùng cuộn (gắn được cả khi vùng hiện ra sau) và instance để
 * cuộn bằng code, ví dụ về đầu trang khi đổi màn hình.
 */
export function useSmoothScroll(): [
  ref: (element: HTMLElement | null) => void,
  lenis: RefObject<Lenis | null>,
] {
  const [wrapper, setWrapper] = useState<HTMLElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!wrapper) return;
    const lenis = new Lenis({
      wrapper,
      content: wrapper,
      // Mỗi nấc lăn đi 60 px (cuộn gốc 100 px), bắt đầu êm (ease-out cubic) và dừng hẳn sau
      // 0,7 giây. Bản đầu (90 px, expo-out) đi nửa quãng trong 80 ms đầu, user thấy nhanh và
      // chóng mặt; kéo dài duration thì trôi lâu, cũng dễ chóng mặt.
      duration: 0.7,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      wheelMultiplier: 0.6,
      // Máy user tắt "Hiệu ứng hoạt hình" của Windows (WebView báo prefers-reduced-motion) mà
      // vẫn muốn cuộn mượt, như hiệu ứng chuyển màn hình (docs/decisions.md).
      respectReducedMotion: false,
      // Đo chiều cao nội dung mỗi lần cần, vì nội dung các vùng đổi liên tục (đổi màn hình,
      // mở rộng chi tiết, thêm dòng) mà không có một khối con cố định để theo dõi.
      naiveDimensions: true,
      // Shift + lăn chuột là cuộn ngang (bảng rộng hơn card): để trình duyệt tự xử lý.
      virtualScroll: ({ event }) => !event.shiftKey,
      autoRaf: true,
    });
    lenisRef.current = lenis;
    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [wrapper]);

  return [setWrapper, lenisRef];
}
