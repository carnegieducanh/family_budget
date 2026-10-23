/**
 * Nơi các máy trao đổi dữ liệu (SPEC mục 5). `syncService` chỉ làm việc qua interface này,
 * nên sau này có thể thêm `supabaseAdapter` hoặc `lanAdapter` mà không sửa UI hay `core/`.
 */
export interface SyncAdapter {
  /** Nơi lưu đang truy cập được (ví dụ thư mục Drive còn tồn tại). */
  isReady(): Promise<boolean>;
  /** Các file của máy khác, không gồm file của máy này và file tạm. */
  listRemote(): Promise<{ name: string; deviceId: string }[]>;
  /** Nội dung thô của một file (có thể đã mã hóa). */
  readRemote(name: string): Promise<string>;
  /** Ghi nguyên tử file của máy này. */
  writeOwn(content: string): Promise<void>;
}
