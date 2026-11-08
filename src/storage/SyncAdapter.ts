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
  /**
   * Tùy chọn, cho nơi sync mà mỗi lần gọi tốn thời gian (Google Apps Script): ghi file của máy
   * này (nếu `ownContent` khác null) rồi trả về nội dung các file của máy khác, trong một lần
   * gọi. Có hàm này thì lượt sync dùng nó thay cho listRemote/readRemote/writeOwn.
   */
  exchange?(ownContent: string | null): Promise<{ name: string; content: string }[]>;
}
