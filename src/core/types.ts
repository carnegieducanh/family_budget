// Data model theo SPEC mục 4. Mọi bản ghi đồng bộ đều kế thừa BaseRecord.

export interface BaseRecord {
  id: string;
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
  updatedBy: string; // userId
  deleted: boolean;
  deletedAt?: string;
}

export type Role = 'admin' | 'member';

export interface User extends BaseRecord {
  name: string;
  role: Role;
  color: string; // màu hiển thị, ví dụ '#4F7DF3'
  /** Ảnh đại diện: ảnh vuông đã thu nhỏ (data URL JPEG/PNG/WebP) hoặc một emoji. Không có thì hiện chữ cái đầu. */
  avatar?: string;
}

export interface Category extends BaseRecord {
  name: string;
  icon: string; // emoji
  order: number;
  hidden: boolean; // danh mục đã dùng chỉ được ẩn, không xóa
}

export interface Transaction extends BaseRecord {
  date: string; // YYYY-MM-DD theo giờ local, ngày thanh toán, quyết định tháng
  amount: number; // yên, số nguyên > 0
  categoryId: string;
  note: string;
  paidBy: string; // userId người trả tiền
  createdBy: string; // userId người nhập
  recurringId?: string; // khoản sinh từ định kỳ có id `rec-${recurringId}-${YYYY-MM}`
}

export interface Budget extends BaseRecord {
  month: string; // 'YYYY-MM' hoặc 'default' (áp dụng mọi tháng)
  categoryId: string | null; // null = ngân sách tổng
  amount: number; // id: `budget-${month}-${categoryId ?? 'total'}`
}

export interface RecurringTemplate extends BaseRecord {
  name: string;
  amount: number;
  categoryId: string;
  paidBy: string;
  dayOfMonth: number; // 1–28
  startMonth: string; // YYYY-MM
  active: boolean;
}

export interface MonthRecord extends BaseRecord {
  month: string; // id: `month-${YYYY-MM}`
  manualUnlockUntil?: string; // admin mở khóa tạm, ISO UTC
  settledAt?: string;
  settledBy?: string;
  settledAmount?: number; // số tiền bù lúc bấm tất toán
  settledPayer?: string; // userId người trả bù
}

export interface DataFile {
  schemaVersion: 1;
  deviceId: string;
  writtenAt: string;
  users: User[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringTemplate[];
  months: MonthRecord[];
}

/** Chỉ lưu local, KHÔNG sync. */
export interface Settings {
  deviceId: string; // UUID tạo lần chạy đầu
  userId: string | null; // máy này là của ai
  syncFolder: string | null; // đường dẫn thư mục Drive
  syncIntervalMin: number; // mặc định 5
  /**
   * Mã hóa file trên Drive (SPEC mục 9). `enabled`: ghi file của máy này dạng mã hóa.
   * `keyB64` + `saltB64`: khóa đã dẫn xuất từ mật khẩu chung (không lưu mật khẩu) và salt đi
   * kèm, dùng để đọc file mã hóa của máy kia và để ghi khi `enabled`.
   */
  encryption: { enabled: boolean; keyB64?: string; saltB64?: string };
  lastSyncAt?: string;
  /**
   * `createdAt` của khoản mới nhất người kia nhập mà máy này đã báo trong popup "khoản chi mới"
   * (core/newTransactions.ts). Chưa có thì app đặt khi mở màn hình chính.
   */
  newTransactionsSeenUntil?: string;
}

/** Dữ liệu người dùng nhập trong form thêm/sửa khoản chi. */
export interface TransactionInput {
  date: string;
  amount: number;
  categoryId: string;
  note: string;
  paidBy: string;
}

/** Ngữ cảnh chung cho các hàm thao tác dữ liệu. */
export interface MutationContext {
  data: DataFile;
  userId: string;
  now: Date;
}
