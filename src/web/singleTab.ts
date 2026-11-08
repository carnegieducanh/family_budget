// Bản web chỉ chạy ở một tab mỗi lúc: hai tab cùng ghi dữ liệu trong trình duyệt (và cùng ghi
// một file trên Drive) thì tab ghi sau sẽ đè thay đổi của tab kia. Tab đầu tiên giữ khóa (Web
// Locks API) đến khi đóng; tab sau thấy khóa đang bị giữ thì không mở dữ liệu.

const LOCK_NAME = 'family-budget-app';

let claim: Promise<boolean> | null = null;

/** true nếu tab này được dùng app. Gọi nhiều lần (StrictMode) vẫn chỉ xin khóa một lần. */
export function claimSingleTab(): Promise<boolean> {
  claim ??= new Promise<boolean>((resolve) => {
    // Trình duyệt cũ chưa có Web Locks: cho dùng như bình thường.
    if (!navigator.locks) {
      resolve(true);
      return;
    }
    navigator.locks
      .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        resolve(lock !== null);
        // Giữ khóa đến khi tab đóng.
        return lock ? new Promise<void>(() => undefined) : undefined;
      })
      .catch(() => resolve(true));
  });
  return claim;
}
