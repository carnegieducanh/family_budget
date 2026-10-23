import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDataFile, serializeDataFile } from '../core/dataFile';
import { deviceFileName, parseDeviceFileName } from '../core/deviceFiles';
import { active, upsert } from '../core/records';
import { NOW, makeData } from '../core/testing';
import { createTransaction, deleteTransaction, updateTransaction } from '../core/transactions';
import type { DataFile, Transaction, TransactionInput } from '../core/types';
import type { SyncAdapter } from '../storage/SyncAdapter';
import {
  FOCUS_MIN_GAP_MS,
  LOCAL_CHANGE_DELAY_MS,
  createSyncScheduler,
  syncOnce,
  type SyncEnv,
  type SyncOutcome,
} from './syncService';

/** Thư mục Drive giả, dùng chung cho các máy. */
class FakeFolder {
  files = new Map<string, string>();
  ready = true;
  failWrites = false;

  adapter(deviceId: string): SyncAdapter {
    return {
      isReady: async () => this.ready,
      listRemote: async () =>
        [...this.files.keys()]
          .map(parseDeviceFileName)
          .filter((f) => f !== null && f.deviceId !== deviceId)
          .map((f) => ({ name: f!.name, deviceId: f!.deviceId })),
      readRemote: async (name) => {
        const content = this.files.get(name);
        if (content === undefined) throw new Error(`Không có file ${name}`);
        return content;
      },
      writeOwn: async (content) => {
        if (this.failWrites) throw new Error('Ổ đĩa đầy');
        this.files.set(deviceFileName(deviceId), content);
      },
    };
  }
}

let clock = NOW;
function tick(minutes = 1): Date {
  clock = new Date(clock.getTime() + minutes * 60_000);
  return clock;
}

/** Một máy: dữ liệu trong bộ nhớ, danh sách backup đã tạo, và người dùng của máy. */
function machine(folder: FakeFolder | null, deviceId: string, userId: string, data: DataFile) {
  const state = { data: { ...data, deviceId }, backups: [] as DataFile[] };
  const env: SyncEnv = {
    adapter: () => folder?.adapter(deviceId) ?? null,
    getData: () => state.data,
    backup: async (snapshot) => {
      state.backups.push(snapshot);
    },
    applyMerged: (merged) => {
      state.data = merged;
    },
    now: () => clock,
  };
  const ctx = () => ({ data: state.data, userId, now: tick() });
  const save = (tx: Transaction) => {
    state.data = { ...state.data, transactions: upsert(state.data.transactions, tx) };
    return tx.id;
  };
  return {
    state,
    env,
    sync: () => syncOnce(env),
    add: (input: TransactionInput) => save(createTransaction(input, ctx(), crypto.randomUUID())),
    edit: (id: string, input: TransactionInput) => save(updateTransaction(find(id), input, ctx())),
    remove: (id: string) => save(deleteTransaction(find(id), ctx())),
    amounts: () => active(state.data.transactions).map((t) => t.amount),
  };
  function find(id: string): Transaction {
    return state.data.transactions.find((t) => t.id === id) as Transaction;
  }
}

function input(amount: number, paidBy = 'user-a'): TransactionInput {
  return { date: '2026-10-10', amount, categoryId: 'cat-grocery', note: '', paidBy };
}

/** Admin A tạo dữ liệu, B tham gia bằng dữ liệu đọc từ thư mục. */
function household() {
  clock = NOW;
  const folder = new FakeFolder();
  const { data } = makeData();
  const a = machine(folder, 'device-a', 'user-a', data);
  const b = machine(folder, 'device-b', 'user-b', structuredClone(data));
  return { folder, a, b };
}

function content(data: DataFile) {
  const { deviceId, writtenAt, ...rest } = data;
  return rest;
}

describe('syncOnce', () => {
  it('chưa chọn thư mục Drive → not-configured', async () => {
    const { data } = makeData();
    expect(await syncOnce(machine(null, 'device-a', 'user-a', data).env)).toEqual({
      kind: 'not-configured',
    });
  });

  it('thư mục không tồn tại → folder-missing, không ghi gì', async () => {
    const { folder, a } = household();
    folder.ready = false;
    expect(await a.sync()).toEqual({ kind: 'folder-missing' });
    expect(folder.files.size).toBe(0);
  });

  it('lượt đầu: chưa có máy kia, vẫn ghi file của mình', async () => {
    const { folder, a } = household();
    const outcome = await a.sync();
    expect(outcome).toMatchObject({ kind: 'ok', changed: false, remotes: [], problems: [] });
    const written = parseDataFile(folder.files.get('device-device-a.json') as string);
    expect(written.deviceId).toBe('device-a');
    expect(written.writtenAt).toBe(clock.toISOString());
  });

  it('thêm ở A → B thấy sau khi A rồi B sync; B tạo backup trước khi gộp', async () => {
    const { a, b } = household();
    await b.sync();
    a.add(input(1200));
    await a.sync();
    const beforeMerge = b.state.data;

    const outcome = await b.sync();
    expect(outcome).toMatchObject({ kind: 'ok', changed: true });
    expect(b.amounts()).toEqual([1200]);
    expect(b.state.backups).toEqual([beforeMerge]);
  });

  it('xóa ở A → B cũng mất khoản đó', async () => {
    const { a, b } = household();
    const id = a.add(input(1200));
    await a.sync();
    await b.sync();
    expect(b.amounts()).toEqual([1200]);

    a.remove(id);
    await a.sync();
    await b.sync();
    expect(b.amounts()).toEqual([]);
    expect(b.state.data.transactions.find((t) => t.id === id)?.deleted).toBe(true);
  });

  it('cả hai sửa khi không sync được, sau đó sync lại → hai máy ra cùng kết quả', async () => {
    const { a, b } = household();
    const shared = a.add(input(1000));
    await a.sync();
    await b.sync();

    // Không sync: A thêm một khoản, sửa khoản chung; B thêm một khoản, sửa khoản chung sau A.
    a.add(input(2000));
    a.edit(shared, input(1100));
    b.add(input(3000, 'user-b'));
    b.edit(shared, input(1300));

    await a.sync();
    await b.sync();
    await a.sync();
    expect(content(a.state.data)).toEqual(content(b.state.data));
    expect(a.amounts().sort((x, y) => x - y)).toEqual([1300, 2000, 3000]);
  });

  it('file máy kia hỏng → bỏ qua, dữ liệu local không đổi, vẫn ghi file của mình', async () => {
    const { folder, a } = household();
    folder.files.set('device-device-b.json', '{"schemaVersion":1, "users": [');
    const before = a.state.data;

    const outcome = await a.sync();
    expect(outcome).toMatchObject({ kind: 'ok', changed: false, remotes: [] });
    expect(outcome.kind === 'ok' && outcome.problems.map((p) => p.reason)).toEqual(['invalid']);
    expect(a.state.data).toBe(before);
    expect(a.state.backups).toEqual([]);
    expect(folder.files.has('device-device-a.json')).toBe(true);
  });

  it('file máy kia có schemaVersion cao hơn → dừng sync, không gộp, không ghi file', async () => {
    const { folder, a, b } = household();
    b.add(input(500, 'user-b'));
    await b.sync();
    const newer = { ...JSON.parse(folder.files.get('device-device-b.json') as string) };
    folder.files.set('device-device-b.json', JSON.stringify({ ...newer, schemaVersion: 2 }));
    const before = a.state.data;

    expect(await a.sync()).toEqual({ kind: 'schema-too-new', version: 2 });
    expect(a.state.data).toBe(before);
    expect(folder.files.has('device-device-a.json')).toBe(false);
  });

  it('người dùng sửa trong lúc đang backup → không mất thay đổi đó', async () => {
    const { a, b } = household();
    b.add(input(700, 'user-b'));
    await b.sync();

    a.env.backup = async () => {
      a.add(input(900)); // thay đổi xảy ra giữa lúc merge và lúc lưu kết quả
    };
    await a.sync();
    expect(a.amounts().sort((x, y) => x - y)).toEqual([700, 900]);
  });

  it('không ghi được file Drive → failed, thông báo rõ bước nào lỗi', async () => {
    const { folder, a } = household();
    folder.failWrites = true;
    expect(await a.sync()).toEqual({
      kind: 'failed',
      message: 'Không ghi được file lên thư mục Drive: Ổ đĩa đầy',
    });
  });

  it('file của máy này ghi ra đọc lại được và đúng dữ liệu', async () => {
    const { folder, a } = household();
    a.add(input(4321));
    await a.sync();
    const written = parseDataFile(folder.files.get('device-device-a.json') as string);
    expect(content(written)).toEqual(content(a.state.data));
    expect(serializeDataFile(written)).toContain('4321');
  });
});

describe('createSyncScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const OK: SyncOutcome = { kind: 'not-configured' };

  /** Lượt sync giả mà test tự quyết định lúc nào xong. */
  function controlledRun() {
    let running = 0;
    let maxRunning = 0;
    const finishers: Array<() => void> = [];
    const run = vi.fn(
      () =>
        new Promise<SyncOutcome>((resolve) => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          finishers.push(() => {
            running--;
            resolve({ kind: 'failed', message: `lượt ${run.mock.calls.length}` });
          });
        }),
    );
    return {
      run,
      finishNext: async () => {
        finishers.shift()?.();
        await vi.advanceTimersByTimeAsync(0);
      },
      maxRunning: () => maxRunning,
    };
  }

  it('yêu cầu đến khi đang chạy được gộp thành một lượt tiếp theo', async () => {
    const control = controlledRun();
    const scheduler = createSyncScheduler(control.run);

    const first = scheduler.request();
    const second = scheduler.request();
    const third = scheduler.request();
    expect(control.run).toHaveBeenCalledTimes(1);

    await control.finishNext();
    expect(await first).toEqual({ kind: 'failed', message: 'lượt 1' });
    expect(control.run).toHaveBeenCalledTimes(2);

    await control.finishNext();
    expect(await second).toEqual({ kind: 'failed', message: 'lượt 2' });
    expect(await third).toEqual({ kind: 'failed', message: 'lượt 2' });
    expect(control.run).toHaveBeenCalledTimes(2);
    expect(control.maxRunning()).toBe(1);
  });

  it('lượt sync ném lỗi → kết quả failed, các lượt sau vẫn chạy', async () => {
    const run = vi
      .fn<() => Promise<SyncOutcome>>()
      .mockRejectedValueOnce(new Error('hỏng'))
      .mockResolvedValue(OK);
    const scheduler = createSyncScheduler(run);
    expect(await scheduler.request()).toEqual({ kind: 'failed', message: 'hỏng' });
    expect(await scheduler.request()).toEqual(OK);
  });

  it('thay đổi local: chỉ sync sau 10 giây không có thay đổi mới', async () => {
    const run = vi.fn(async () => OK);
    const scheduler = createSyncScheduler(run);
    scheduler.notifyLocalChange();
    await vi.advanceTimersByTimeAsync(6_000);
    scheduler.notifyLocalChange();
    await vi.advanceTimersByTimeAsync(LOCAL_CHANGE_DELAY_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('sync định kỳ theo chu kỳ, đổi chu kỳ thì hẹn lại', async () => {
    const run = vi.fn(async () => OK);
    const scheduler = createSyncScheduler(run);
    scheduler.setIntervalMinutes(5);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.setIntervalMinutes(1);
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(run).toHaveBeenCalledTimes(5);
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(run).toHaveBeenCalledTimes(5);
  });

  it('focus lại ngay sau một lượt sync thì bỏ qua, quá 30 giây thì sync', async () => {
    const run = vi.fn(async () => OK);
    const scheduler = createSyncScheduler(run);
    await scheduler.request();
    scheduler.notifyFocus();
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(FOCUS_MIN_GAP_MS);
    scheduler.notifyFocus();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('báo bắt đầu và kết thúc mỗi lượt', async () => {
    const events: string[] = [];
    const scheduler = createSyncScheduler(async () => OK, {
      onStart: () => events.push('start'),
      onFinish: (outcome) => events.push(outcome.kind),
    });
    await scheduler.request();
    expect(events).toEqual(['start', 'not-configured']);
  });
});
