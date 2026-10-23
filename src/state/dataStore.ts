import { create } from 'zustand';
import { createInitialData } from '../core/defaults';
import { DomainError } from '../core/errors';
import { relockMonth, unlockMonth } from '../core/monthLock';
import { active, upsert } from '../core/records';
import { computeSettlement, markSettled } from '../core/settlement';
import { createTransaction, deleteTransaction, updateTransaction } from '../core/transactions';
import type { DataFile, MutationContext, Settings, TransactionInput, User } from '../core/types';
import { loadData, loadSettings, saveData, saveSettings } from '../storage/localStore';

export type LoadStatus = 'loading' | 'setup' | 'ready' | 'error';

interface DataState {
  status: LoadStatus;
  /** Lỗi khi đọc dữ liệu lúc mở app; app dừng ở màn hình lỗi, không ghi gì. */
  loadError: string | null;
  /** Lỗi khi ghi data.json; dữ liệu vẫn còn trong bộ nhớ và sẽ ghi lại ở lần thay đổi sau. */
  saveError: string | null;
  data: DataFile | null;
  settings: Settings | null;

  /** Đọc dữ liệu lúc mở app. Gọi nhiều lần vẫn chỉ đọc một lần. */
  init(): Promise<void>;
  /** Ghi lại data.json sau khi lần ghi trước bị lỗi. */
  retrySave(): void;
  /** Thiết lập lần đầu (rút gọn): tạo 2 người, người tạo là admin. */
  createHousehold(myName: string, otherName: string): Promise<void>;
  /** Máy đã có data.json nhưng chưa biết là của ai: chọn "Tôi là ...". */
  chooseUser(userId: string): Promise<void>;

  // Các thao tác dưới đây ném DomainError (thông báo tiếng Việt) khi bị từ chối.
  addTransaction(input: TransactionInput): string;
  updateTransaction(id: string, input: TransactionInput): void;
  deleteTransaction(id: string): void;
  unlockMonth(month: string): void;
  relockMonth(month: string): void;
  markSettled(month: string): void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Hai người dùng của gia đình, theo thứ tự tạo (admin tạo trước). */
export function householdUsers(data: DataFile): [User, User] {
  const users = active(data.users);
  const [first, second] = users;
  if (!first || !second || users.length !== 2) {
    throw new DomainError('Dữ liệu phải có đúng 2 người dùng.');
  }
  return [first, second];
}

// React StrictMode chạy effect 2 lần khi dev; nếu init chạy 2 lần song song ở lần mở đầu
// tiên thì có thể sinh 2 deviceId khác nhau.
let initPromise: Promise<void> | null = null;

export const useDataStore = create<DataState>()((set, get) => {
  function context(): MutationContext {
    const { data, settings } = get();
    if (!data || !settings?.userId) throw new DomainError('Chưa thiết lập dữ liệu.');
    return { data, userId: settings.userId, now: new Date() };
  }

  function requireAdmin(ctx: MutationContext): void {
    const me = ctx.data.users.find((u) => u.id === ctx.userId);
    if (me?.role !== 'admin') throw new DomainError('Chỉ admin được làm thao tác này.');
  }

  /** Lưu thay đổi vào bộ nhớ ngay, rồi ghi data.json (ghi nguyên tử, theo hàng đợi). */
  function commit(data: DataFile): void {
    set({ data });
    saveData(data).then(
      () => set({ saveError: null }),
      (error: unknown) => set({ saveError: errorMessage(error) }),
    );
  }

  function findTransaction(ctx: MutationContext, id: string) {
    const tx = ctx.data.transactions.find((t) => t.id === id);
    if (!tx) throw new DomainError('Không tìm thấy khoản chi.');
    return tx;
  }

  return {
    status: 'loading',
    loadError: null,
    saveError: null,
    data: null,
    settings: null,

    init() {
      initPromise ??= (async () => {
        try {
          const settings = await loadSettings();
          const data = await loadData();
          const known = data && settings.userId && data.users.some((u) => u.id === settings.userId);
          set({ settings, data, status: known ? 'ready' : 'setup' });
        } catch (error) {
          set({ status: 'error', loadError: errorMessage(error) });
        }
      })();
      return initPromise;
    },

    retrySave() {
      const { data } = get();
      if (data) commit(data);
    },

    async createHousehold(myName, otherName) {
      const { settings, data: existing } = get();
      if (!settings) throw new DomainError('Chưa đọc được settings.');
      if (existing) throw new DomainError('Máy này đã có dữ liệu, hãy chọn "Tôi là ...".');
      if (!myName.trim() || !otherName.trim()) throw new DomainError('Hãy nhập tên cả 2 người.');
      if (myName.trim() === otherName.trim()) throw new DomainError('Tên 2 người phải khác nhau.');

      const { data, myUserId } = createInitialData({
        deviceId: settings.deviceId,
        myName,
        otherName,
        now: new Date(),
        newId: () => crypto.randomUUID(),
      });
      const nextSettings = { ...settings, userId: myUserId };
      await saveData(data);
      await saveSettings(nextSettings);
      set({ data, settings: nextSettings, status: 'ready', saveError: null });
    },

    async chooseUser(userId) {
      const { settings, data } = get();
      if (!settings || !data) throw new DomainError('Chưa có dữ liệu.');
      if (!active(data.users).some((u) => u.id === userId)) {
        throw new DomainError('Không tìm thấy người dùng.');
      }
      const nextSettings = { ...settings, userId };
      await saveSettings(nextSettings);
      set({ settings: nextSettings, status: 'ready' });
    },

    addTransaction(input) {
      const ctx = context();
      const tx = createTransaction(input, ctx, crypto.randomUUID());
      commit({ ...ctx.data, transactions: upsert(ctx.data.transactions, tx) });
      return tx.id;
    },

    updateTransaction(id, input) {
      const ctx = context();
      const tx = updateTransaction(findTransaction(ctx, id), input, ctx);
      commit({ ...ctx.data, transactions: upsert(ctx.data.transactions, tx) });
    },

    deleteTransaction(id) {
      const ctx = context();
      const tx = deleteTransaction(findTransaction(ctx, id), ctx);
      commit({ ...ctx.data, transactions: upsert(ctx.data.transactions, tx) });
    },

    unlockMonth(month) {
      const ctx = context();
      requireAdmin(ctx);
      const record = unlockMonth(ctx.data.months, month, ctx.userId, ctx.now);
      commit({ ...ctx.data, months: upsert(ctx.data.months, record) });
    },

    relockMonth(month) {
      const ctx = context();
      requireAdmin(ctx);
      const record = relockMonth(ctx.data.months, month, ctx.userId, ctx.now);
      commit({ ...ctx.data, months: upsert(ctx.data.months, record) });
    },

    markSettled(month) {
      const ctx = context();
      const [a, b] = householdUsers(ctx.data);
      const settlement = computeSettlement(ctx.data.transactions, [a.id, b.id], month);
      const record = markSettled(ctx.data.months, settlement, ctx.userId, ctx.now);
      commit({ ...ctx.data, months: upsert(ctx.data.months, record) });
    },
  };
});

/** Dữ liệu khi app đã sẵn sàng. Chỉ dùng bên trong cây giao diện chính. */
export function useReadyData(): { data: DataFile; me: User; users: [User, User] } {
  const data = useDataStore((s) => s.data);
  const userId = useDataStore((s) => s.settings?.userId);
  if (!data || !userId) throw new Error('useReadyData được gọi khi dữ liệu chưa sẵn sàng.');
  const me = data.users.find((u) => u.id === userId);
  if (!me) throw new Error('Không tìm thấy người dùng của máy này.');
  return { data, me, users: householdUsers(data) };
}
