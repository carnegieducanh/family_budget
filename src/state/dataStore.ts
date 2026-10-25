import { create } from 'zustand';
import { applyRecurringToBudgets, setManualBudget } from '../core/budget';
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  setCategoryHidden,
  updateCategory,
  type CategoryInput,
} from '../core/categories';
import { checkAvatar } from '../core/avatar';
import { importTransactions, prepareImport } from '../core/csv';
import { createInitialData } from '../core/defaults';
import { DomainError } from '../core/errors';
import { householdUsers } from '../core/household';
import { relockMonth, unlockMonth } from '../core/monthLock';
import { assertCan, canEditAvatar, type Action } from '../core/permissions';
import { active, upsert } from '../core/records';
import {
  createRecurring,
  deleteRecurring,
  generateRecurring,
  updateRecurring,
  type RecurringInput,
} from '../core/recurring';
import { planRestore, type RestorePlan } from '../core/restore';
import { computeSettlement, markSettled } from '../core/settlement';
import { createTransaction, deleteTransaction, updateTransaction } from '../core/transactions';
import type {
  BaseRecord,
  DataFile,
  MutationContext,
  RecurringTemplate,
  Settings,
  Transaction,
  TransactionInput,
  User,
} from '../core/types';
import { setAvatar, transferAdmin, updateUser, type UserInput } from '../core/users';
import { createSnapshot } from '../storage/backup';
import {
  checkNewPassword,
  createFileKey,
  exportFileKey,
  fileKeyFromPassword,
  type StoredKey,
} from '../storage/crypto';
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
  /** Tăng sau mỗi thay đổi do người dùng trên máy này (không tính dữ liệu gộp từ máy kia). */
  localRevision: number;

  /** Đọc dữ liệu lúc mở app. Gọi nhiều lần vẫn chỉ đọc một lần. */
  init(): Promise<void>;
  /** Ghi lại data.json sau khi lần ghi trước bị lỗi. */
  retrySave(): void;
  /**
   * Máy admin, thiết lập lần đầu: tạo 2 người (người tạo là admin, kèm ảnh đại diện) và chọn
   * thư mục Drive.
   */
  createHousehold(
    myName: string,
    otherName: string,
    myAvatar: string,
    syncFolder: string,
  ): Promise<void>;
  /**
   * Máy thứ hai: dùng dữ liệu đọc từ thư mục Drive, chọn "Tôi là ..." và đặt ảnh đại diện.
   * `encryption`: khóa dẫn xuất từ mật khẩu chung, nếu dữ liệu trong thư mục đã được mã hóa.
   */
  joinHousehold(
    data: DataFile,
    userId: string,
    avatar: string,
    syncFolder: string,
    encryption: StoredKey | null,
  ): Promise<void>;
  /** Máy đã có data.json nhưng chưa biết là của ai: chọn "Tôi là ..." và đặt ảnh đại diện. */
  chooseUser(userId: string, avatar: string): Promise<void>;
  /** Thay dữ liệu bằng kết quả merge của lượt sync (đã backup trước đó). */
  applyMerged(data: DataFile): void;
  /** Cài đặt riêng của máy này (thư mục sync, chu kỳ sync...). */
  updateSettings(changes: Partial<Omit<Settings, 'deviceId'>>): Promise<void>;
  /** Dữ liệu, người dùng của máy này và thời điểm hiện tại, để xem trước một thao tác. */
  context(): MutationContext;

  // Mã hóa file trên Drive (SPEC mục 9). Khóa lưu trong settings.json, không lưu mật khẩu.
  /** Admin đặt mật khẩu mới (bật mã hóa hoặc đổi mật khẩu): khóa mới với salt mới. */
  setEncryptionPassword(password: string, confirm: string): Promise<void>;
  /** Nhập mật khẩu chung đã đặt ở máy kia; kiểm tra bằng các file mã hóa của máy kia. */
  enterEncryptionPassword(password: string, envelopes: readonly string[]): Promise<void>;
  /** Admin tắt mã hóa: ghi file dạng thường, vẫn giữ khóa để đọc file mã hóa của máy kia. */
  disableEncryption(): Promise<void>;

  // Các thao tác dưới đây kiểm tra quyền (SPEC mục 7) và luật khóa tháng,
  // ném DomainError (thông báo tiếng Việt) khi bị từ chối.
  addTransaction(input: TransactionInput): string;
  updateTransaction(id: string, input: TransactionInput): void;
  deleteTransaction(id: string): void;
  unlockMonth(month: string): void;
  relockMonth(month: string): void;
  markSettled(month: string): void;

  addCategory(input: CategoryInput): string;
  updateCategory(id: string, input: CategoryInput): void;
  setCategoryHidden(id: string, hidden: boolean): void;
  deleteCategory(id: string): void;
  reorderCategories(orderedIds: string[]): void;

  /** `amount = null` là bỏ mức ngân sách đó. */
  setBudget(month: string, categoryId: string | null, amount: number | null): void;

  addRecurring(input: RecurringInput): string;
  updateRecurring(id: string, input: RecurringInput): void;
  deleteRecurring(id: string): void;
  /** Sinh khoản định kỳ của tháng hiện tại (tự động, không cần quyền). Trả về số khoản mới. */
  generateRecurring(): number;

  updateUser(id: string, input: UserInput): void;
  /** Đặt ảnh đại diện, `null` là bỏ. Mỗi người tự đổi của mình, admin đổi được của cả hai. */
  setAvatar(id: string, avatar: string | null): void;
  transferAdmin(userId: string): void;

  /** Nhập CSV (đã xem trước), tạo backup trước khi ghi. Trả về số khoản đã nhập. */
  importCsv(text: string): Promise<number>;
  /** Khôi phục một bản backup theo cách ở SPEC mục 9, tạo backup trước khi ghi. */
  restore(snapshot: DataFile): Promise<RestorePlan>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function upsertAll<T extends BaseRecord>(list: readonly T[], records: readonly T[]): T[] {
  return records.reduce<T[]>((result, record) => upsert(result, record), [...list]);
}

function find<T extends BaseRecord>(list: readonly T[], id: string, what: string): T {
  const record = list.find((r) => r.id === id);
  if (!record) throw new DomainError(`Không tìm thấy ${what}.`);
  return record;
}

/** Dữ liệu sau khi người dùng máy này đặt ảnh đại diện của mình lúc thiết lập. */
function withAvatar(data: DataFile, userId: string, avatar: string): DataFile {
  const user = find(active(data.users), userId, 'người dùng');
  if (user.avatar === avatar) return data;
  const updated = setAvatar(user, avatar, { data, userId, now: new Date() });
  return { ...data, users: upsert(data.users, updated) };
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

  /** Ngữ cảnh thao tác, sau khi đã kiểm tra quyền của người dùng máy này. */
  function authorized(action: Action, record?: Transaction): MutationContext {
    const ctx = context();
    assertCan(
      ctx.data.users.find((u) => u.id === ctx.userId),
      action,
      record,
    );
    return ctx;
  }

  /** Ghi data.json (ghi nguyên tử, theo hàng đợi). Bộ nhớ đã được cập nhật trước đó. */
  function save(data: DataFile): void {
    saveData(data).then(
      () => set({ saveError: null }),
      (error: unknown) => set({ saveError: errorMessage(error) }),
    );
  }

  /** Lưu thay đổi của người dùng; lịch sync sẽ ghi file Drive sau 10 giây. */
  function commit(data: DataFile): void {
    set((s) => ({ data, localRevision: s.localRevision + 1 }));
    save(data);
  }

  /** Lưu mẫu định kỳ cùng ngân sách của danh mục, luôn bằng tổng các mẫu đang bật. */
  function commitRecurring(ctx: MutationContext, template: RecurringTemplate): void {
    const recurring = upsert(ctx.data.recurring, template);
    const budgets = applyRecurringToBudgets(ctx.data.recurring, recurring, ctx);
    commit({ ...ctx.data, recurring, budgets: upsertAll(ctx.data.budgets, budgets) });
  }

  function requireSettings(): Settings {
    const { settings } = get();
    if (!settings) throw new DomainError('Chưa đọc được settings.');
    return settings;
  }

  function transaction(id: string): Transaction {
    return find(context().data.transactions, id, 'khoản chi');
  }

  return {
    status: 'loading',
    loadError: null,
    saveError: null,
    data: null,
    settings: null,
    localRevision: 0,

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

    async createHousehold(myName, otherName, myAvatar, syncFolder) {
      const settings = requireSettings();
      if (get().data) throw new DomainError('Máy này đã có dữ liệu, hãy chọn "Tôi là ...".');
      if (!myName.trim() || !otherName.trim()) throw new DomainError('Hãy nhập tên cả 2 người.');
      if (myName.trim() === otherName.trim()) throw new DomainError('Tên 2 người phải khác nhau.');

      const { data, myUserId } = createInitialData({
        deviceId: settings.deviceId,
        myName,
        otherName,
        myAvatar: checkAvatar(myAvatar),
        now: new Date(),
        newId: () => crypto.randomUUID(),
      });
      const nextSettings = { ...settings, userId: myUserId, syncFolder };
      await saveData(data);
      await saveSettings(nextSettings);
      set({ data, settings: nextSettings, status: 'ready', saveError: null });
    },

    async joinHousehold(joined, userId, avatar, syncFolder, encryption) {
      const settings = requireSettings();
      if (get().data) throw new DomainError('Máy này đã có dữ liệu, hãy chọn "Tôi là ...".');
      if (joined.deviceId !== settings.deviceId) throw new DomainError('Dữ liệu không đúng máy.');
      householdUsers(joined); // phải đúng 2 người
      const data = withAvatar(joined, userId, avatar);
      const nextSettings: Settings = {
        ...settings,
        userId,
        syncFolder,
        ...(encryption ? { encryption: { enabled: true, ...encryption } } : {}),
      };
      await saveData(data);
      await saveSettings(nextSettings);
      set({ data, settings: nextSettings, status: 'ready', saveError: null });
    },

    async chooseUser(userId, avatar) {
      const { settings, data: current } = get();
      if (!settings || !current) throw new DomainError('Chưa có dữ liệu.');
      const data = withAvatar(current, userId, avatar);
      const nextSettings = { ...settings, userId };
      if (data !== current) await saveData(data);
      await saveSettings(nextSettings);
      set({ data, settings: nextSettings, status: 'ready' });
    },

    applyMerged(data) {
      set({ data });
      save(data);
    },

    async updateSettings(changes) {
      // Cập nhật bộ nhớ trước để hai lần gọi liền nhau không làm mất thay đổi của nhau;
      // các lần ghi file đi theo hàng đợi nên bản ghi sau cùng có đủ mọi thay đổi.
      const nextSettings = { ...requireSettings(), ...changes };
      set({ settings: nextSettings });
      await saveSettings(nextSettings);
    },

    context,

    async setEncryptionPassword(password, confirm) {
      authorized('encryption:manage');
      checkNewPassword(password, confirm);
      const key = await exportFileKey(await createFileKey(password));
      await get().updateSettings({ encryption: { enabled: true, ...key } });
    },

    async enterEncryptionPassword(password, envelopes) {
      context();
      const key = await exportFileKey(await fileKeyFromPassword(password, envelopes));
      await get().updateSettings({ encryption: { enabled: true, ...key } });
    },

    async disableEncryption() {
      authorized('encryption:manage');
      const { encryption } = requireSettings();
      await get().updateSettings({ encryption: { ...encryption, enabled: false } });
    },

    // --- Khoản chi và tháng

    addTransaction(input) {
      const ctx = authorized('transaction:create');
      const tx = createTransaction(input, ctx, crypto.randomUUID());
      commit({ ...ctx.data, transactions: upsert(ctx.data.transactions, tx) });
      return tx.id;
    },

    updateTransaction(id, input) {
      const existing = transaction(id);
      const ctx = authorized('transaction:edit', existing);
      const tx = updateTransaction(existing, input, ctx);
      commit({ ...ctx.data, transactions: upsert(ctx.data.transactions, tx) });
    },

    deleteTransaction(id) {
      const existing = transaction(id);
      const ctx = authorized('transaction:edit', existing);
      const tx = deleteTransaction(existing, ctx);
      commit({ ...ctx.data, transactions: upsert(ctx.data.transactions, tx) });
    },

    unlockMonth(month) {
      const ctx = authorized('month:unlock');
      const record = unlockMonth(ctx.data.months, month, ctx.userId, ctx.now);
      commit({ ...ctx.data, months: upsert(ctx.data.months, record) });
    },

    relockMonth(month) {
      const ctx = authorized('month:unlock');
      const record = relockMonth(ctx.data.months, month, ctx.userId, ctx.now);
      commit({ ...ctx.data, months: upsert(ctx.data.months, record) });
    },

    markSettled(month) {
      const ctx = authorized('month:settle');
      const [a, b] = householdUsers(ctx.data);
      const settlement = computeSettlement(ctx.data.transactions, [a.id, b.id], month);
      const record = markSettled(ctx.data.months, settlement, ctx.userId, ctx.now);
      commit({ ...ctx.data, months: upsert(ctx.data.months, record) });
    },

    // --- Danh mục

    addCategory(input) {
      const ctx = authorized('categories:manage');
      const category = createCategory(input, ctx, crypto.randomUUID());
      commit({ ...ctx.data, categories: upsert(ctx.data.categories, category) });
      return category.id;
    },

    updateCategory(id, input) {
      const ctx = authorized('categories:manage');
      const category = updateCategory(find(ctx.data.categories, id, 'danh mục'), input, ctx);
      commit({ ...ctx.data, categories: upsert(ctx.data.categories, category) });
    },

    setCategoryHidden(id, hidden) {
      const ctx = authorized('categories:manage');
      const category = setCategoryHidden(find(ctx.data.categories, id, 'danh mục'), hidden, ctx);
      commit({ ...ctx.data, categories: upsert(ctx.data.categories, category) });
    },

    deleteCategory(id) {
      const ctx = authorized('categories:manage');
      const category = deleteCategory(find(ctx.data.categories, id, 'danh mục'), ctx);
      commit({ ...ctx.data, categories: upsert(ctx.data.categories, category) });
    },

    reorderCategories(orderedIds) {
      const ctx = authorized('categories:manage');
      const changed = reorderCategories(orderedIds, ctx);
      if (changed.length > 0) {
        commit({ ...ctx.data, categories: upsertAll(ctx.data.categories, changed) });
      }
    },

    // --- Ngân sách

    setBudget(month, categoryId, amount) {
      const ctx = authorized('budgets:manage');
      const budget = setManualBudget(month, categoryId, amount, ctx);
      if (budget) commit({ ...ctx.data, budgets: upsert(ctx.data.budgets, budget) });
    },

    // --- Chi tiêu định kỳ

    addRecurring(input) {
      const ctx = authorized('recurring:manage');
      const template = createRecurring(input, ctx, crypto.randomUUID());
      commitRecurring(ctx, template);
      get().generateRecurring();
      return template.id;
    },

    updateRecurring(id, input) {
      const ctx = authorized('recurring:manage');
      const template = updateRecurring(find(ctx.data.recurring, id, 'mẫu định kỳ'), input, ctx);
      commitRecurring(ctx, template);
      get().generateRecurring();
    },

    deleteRecurring(id) {
      const ctx = authorized('recurring:manage');
      commitRecurring(ctx, deleteRecurring(find(ctx.data.recurring, id, 'mẫu định kỳ'), ctx));
    },

    generateRecurring() {
      const { data } = get();
      if (!data) return 0;
      const generated = generateRecurring(data, new Date());
      if (generated.length > 0) {
        commit({ ...data, transactions: upsertAll(data.transactions, generated) });
      }
      return generated.length;
    },

    // --- Người dùng

    updateUser(id, input) {
      const ctx = authorized('users:manage');
      const user = updateUser(find(ctx.data.users, id, 'người dùng'), input, ctx);
      commit({ ...ctx.data, users: upsert(ctx.data.users, user) });
    },

    setAvatar(id, avatar) {
      const ctx = context();
      const target = find(ctx.data.users, id, 'người dùng');
      if (
        !canEditAvatar(
          ctx.data.users.find((u) => u.id === ctx.userId),
          target,
        )
      ) {
        throw new DomainError('Chỉ admin đổi được ảnh đại diện của người kia.');
      }
      commit({ ...ctx.data, users: upsert(ctx.data.users, setAvatar(target, avatar, ctx)) });
    },

    transferAdmin(userId) {
      const ctx = authorized('users:manage');
      commit({ ...ctx.data, users: upsertAll(ctx.data.users, transferAdmin(userId, ctx)) });
    },

    // --- Import và khôi phục: luôn tạo backup trước khi ghi (SPEC mục 8, 9)

    async importCsv(text) {
      const before = authorized('csv:import');
      await createSnapshot(before.data);
      // Dữ liệu có thể vừa đổi (sync) trong lúc ghi backup: kiểm tra lại trên bản mới nhất.
      const ctx = authorized('csv:import');
      const imported = importTransactions(prepareImport(text, ctx), ctx, () => crypto.randomUUID());
      if (imported.length > 0) {
        commit({ ...ctx.data, transactions: upsertAll(ctx.data.transactions, imported) });
      }
      return imported.length;
    },

    async restore(snapshot) {
      const before = authorized('backup:restore');
      await createSnapshot(before.data);
      const ctx = authorized('backup:restore');
      const plan = planRestore(ctx.data, snapshot, ctx.userId, ctx.now);
      commit(plan.data);
      return plan;
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
