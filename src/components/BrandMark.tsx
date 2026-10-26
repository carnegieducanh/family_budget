import mark64 from '../assets/brand-mark-64.png';
import mark128 from '../assets/brand-mark-128.png';

/**
 * Logo của app: sổ tiết kiệm gập kiểu ゆうちょ trên nền xanh bo góc, cắt từ cùng ảnh với icon app
 * (src-tauri/icons/_source). Giống nhau ở cả hai theme.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src={mark128}
      srcSet={`${mark64} 64w, ${mark128} 128w`}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  );
}
