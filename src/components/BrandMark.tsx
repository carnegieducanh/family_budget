import { useId } from 'react';

/**
 * Logo của app: mái nhà và đồng xu trên nền xanh bo góc. Gradient lấy từ icon app ゆうちょ:
 * xanh đều nửa trên trái, chuyển sang xanh vàng ở góc dưới phải. Giống nhau ở cả hai theme.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  const gradient = `${useId()}-brand`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0.48" stopColor="#40b340" />
          <stop offset="1" stopColor="#a0d04e" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradient})`} />
      <path
        d="M8.5 15.2 16 9l7.5 6.2V22.5a1.5 1.5 0 0 1-1.5 1.5H10a1.5 1.5 0 0 1-1.5-1.5Z"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="18.6" r="2.6" fill="#fff" />
    </svg>
  );
}
