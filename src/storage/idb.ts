// Kho "tên → nội dung" trong IndexedDB của trình duyệt, thay cho các file trong thư mục app data
// ở bản web. Mỗi lần ghi là một transaction của IndexedDB: hoặc ghi xong cả, hoặc không ghi gì,
// nên không cần file tạm như khi ghi file (SPEC mục 5, ghi nguyên tử).

const DB_NAME = 'family-budget';
const STORE = 'files';

let dbPromise: Promise<IDBDatabase> | null = null;

function failure(error: DOMException | null, fallback: string): Error {
  return error ?? new Error(fallback);
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      const db = request.result;
      // Trang khác cần nâng cấp cấu trúc kho: đóng lại để không chặn, lần sau mở lại.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(failure(request.error, 'Không mở được kho dữ liệu.'));
    request.onblocked = () => reject(new Error('Kho dữ liệu đang bị trang khác giữ.'));
  }).catch((error: unknown) => {
    dbPromise = null; // lần sau thử lại
    throw error;
  });
  return dbPromise;
}

/** Chạy một thao tác trong transaction riêng; xong khi transaction đã ghi xong. */
async function run<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(STORE, mode);
  const request = operation(tx.objectStore(STORE));
  const result = new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(failure(request.error, 'Lỗi kho dữ liệu.'));
  });
  result.catch(() => undefined); // lỗi được báo qua transaction bên dưới
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(failure(tx.error, 'Lỗi kho dữ liệu.'));
    tx.onabort = () => reject(failure(tx.error, 'Ghi dữ liệu bị hủy.'));
  });
  return result;
}

export async function idbGet(name: string): Promise<string | null> {
  const value: unknown = await run('readonly', (store) => store.get(name));
  return typeof value === 'string' ? value : null;
}

export async function idbSet(name: string, content: string): Promise<void> {
  await run('readwrite', (store) => store.put(content, name));
}

export async function idbDelete(name: string): Promise<void> {
  await run('readwrite', (store) => store.delete(name));
}

/** Tên các mục bắt đầu bằng `prefix`. */
export async function idbNames(prefix: string): Promise<string[]> {
  const keys = await run('readonly', (store) =>
    store.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`)),
  );
  return keys.filter((key): key is string => typeof key === 'string');
}

/**
 * Xin trình duyệt giữ dữ liệu của trang, không tự xóa khi máy thiếu chỗ (Safari trên iPhone xóa
 * dữ liệu của trang lâu không mở, trừ khi trang được thêm vào Màn hình chính).
 */
export function requestPersistentStorage(): void {
  navigator.storage?.persist?.().catch(() => undefined);
}
