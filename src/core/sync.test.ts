import { describe, expect, it } from 'vitest';
import { serializeDataFile } from './dataFile';
import { createEmptyData, createInitialData } from './defaults';
import { NOW, makeData, makeTx } from './testing';
import {
  JOIN_NEEDS_PASSWORD_MESSAGE,
  connectProblem,
  dataForJoin,
  mergeRemoteFiles,
  type RemoteFile,
} from './sync';
import type { DataFile } from './types';

function setup() {
  const { data, a, b } = makeData();
  const local: DataFile = { ...data, deviceId: 'device-a' };
  const remote: DataFile = {
    ...structuredClone(data),
    deviceId: 'device-b',
    writtenAt: NOW.toISOString(),
    transactions: [makeTx({ id: 'tx-b', date: '2026-10-03', amount: 5000, paidBy: b })],
  };
  return { local, remote, a, b };
}

function file(data: DataFile, name = `device-${data.deviceId}.json`): RemoteFile {
  return { name, content: serializeDataFile(data) };
}

function otherHousehold(): DataFile {
  const ids = ['user-x', 'user-y'];
  return createInitialData({
    deviceId: 'device-x',
    myName: 'X',
    otherName: 'Y',
    now: NOW,
    newId: () => ids.shift() as string,
  }).data;
}

describe('mergeRemoteFiles', () => {
  it('không có file nào của máy khác → giữ nguyên local', () => {
    const { local } = setup();
    const result = mergeRemoteFiles(local, [], NOW);
    expect(result).toMatchObject({ kind: 'merged', changed: false, remotes: [], problems: [] });
    expect(result.kind === 'merged' && result.data).toBe(local);
  });

  it('gộp dữ liệu máy kia và báo có thay đổi', () => {
    const { local, remote } = setup();
    const result = mergeRemoteFiles(local, [file(remote)], NOW);
    if (result.kind !== 'merged') throw new Error(result.kind);
    expect(result.changed).toBe(true);
    expect(result.data.deviceId).toBe('device-a');
    expect(result.data.transactions.map((t) => t.id)).toEqual(['tx-b']);
    expect(result.remotes).toEqual([
      {
        name: 'device-device-b.json',
        deviceId: 'device-b',
        writtenAt: NOW.toISOString(),
        encrypted: false,
      },
    ]);
  });

  it('dữ liệu đã giống nhau → không có thay đổi', () => {
    const { local, remote } = setup();
    const same = { ...local, transactions: remote.transactions };
    const result = mergeRemoteFiles(same, [file(remote)], NOW);
    expect(result).toMatchObject({ kind: 'merged', changed: false });
  });

  it('file JSON hỏng → bỏ qua file đó, dữ liệu local không đổi', () => {
    const { local } = setup();
    const before = structuredClone(local);
    const result = mergeRemoteFiles(
      local,
      [{ name: 'device-b.json', content: '{"schemaVersion": 1, "users": [' }],
      NOW,
    );
    if (result.kind !== 'merged') throw new Error(result.kind);
    expect(result.changed).toBe(false);
    expect(result.data).toEqual(before);
    expect(result.remotes).toEqual([]);
    expect(result.problems).toEqual([
      { name: 'device-b.json', reason: 'invalid', message: expect.stringContaining('hỏng') },
    ]);
  });

  it('file sai cấu trúc → bỏ qua, vẫn gộp các file hợp lệ khác', () => {
    const { local, remote } = setup();
    const broken = JSON.parse(serializeDataFile(remote));
    broken.transactions[0].amount = 'năm nghìn';
    const result = mergeRemoteFiles(
      local,
      [{ name: 'device-c.json', content: JSON.stringify(broken) }, file(remote, 'device-b.json')],
      NOW,
    );
    if (result.kind !== 'merged') throw new Error(result.kind);
    expect(result.data.transactions.map((t) => t.id)).toEqual(['tx-b']);
    expect(result.problems).toEqual([
      { name: 'device-c.json', reason: 'invalid', message: expect.stringContaining('amount') },
    ]);
  });

  it('file có schemaVersion cao hơn → dừng cả lượt sync, không gộp file nào', () => {
    const { local, remote } = setup();
    const newer = { ...remote, deviceId: 'device-c', schemaVersion: 2 };
    const result = mergeRemoteFiles(
      local,
      [file(remote, 'device-b.json'), { name: 'device-c.json', content: JSON.stringify(newer) }],
      NOW,
    );
    expect(result).toEqual({ kind: 'schema-too-new', name: 'device-c.json', version: 2 });
  });

  it('file của một gia đình khác → bỏ qua', () => {
    const { local } = setup();
    const result = mergeRemoteFiles(local, [file(otherHousehold(), 'device-x.json')], NOW);
    if (result.kind !== 'merged') throw new Error(result.kind);
    expect(result.changed).toBe(false);
    expect(result.problems.map((p) => p.reason)).toEqual(['other-household']);
  });

  it('file không đọc hoặc không giải mã được → bỏ qua và giữ nguyên lý do', async () => {
    const { local } = setup();
    const unreadable: RemoteFile = {
      name: 'device-b.json',
      reason: 'unreadable',
      message: 'Permission denied',
    };
    const encrypted: RemoteFile = {
      name: 'device-c.enc.json',
      reason: 'encrypted',
      message: 'Máy kia đã bật mã hóa.',
    };
    const result = mergeRemoteFiles(local, [unreadable, encrypted], NOW);
    if (result.kind !== 'merged') throw new Error(result.kind);
    expect(result.changed).toBe(false);
    expect(result.problems).toEqual([unreadable, encrypted]);
  });

  it('file mã hóa đã giải mã → gộp như file thường, ghi nhận máy kia đang mã hóa', () => {
    const { local, remote } = setup();
    const result = mergeRemoteFiles(local, [file(remote, 'device-device-b.enc.json')], NOW);
    if (result.kind !== 'merged') throw new Error(result.kind);
    expect(result.data.transactions.map((t) => t.id)).toEqual(['tx-b']);
    expect(result.remotes.map((r) => [r.deviceId, r.encrypted])).toEqual([['device-b', true]]);
  });

  it('báo lệch giờ khi máy kia ghi ở thời điểm vượt quá 5 phút', () => {
    const { local, remote } = setup();
    const ahead = { ...remote, writtenAt: new Date(NOW.getTime() + 10 * 60_000).toISOString() };
    const result = mergeRemoteFiles(local, [file(ahead)], NOW);
    expect(result).toMatchObject({ kind: 'merged', clockSkew: true });
    expect(mergeRemoteFiles(local, [file(remote)], NOW)).toMatchObject({ clockSkew: false });
  });

  it('máy tham gia (local rỗng) nhận toàn bộ dữ liệu máy kia, giữ deviceId của mình', () => {
    const { remote } = setup();
    const result = mergeRemoteFiles(createEmptyData('device-new', NOW), [file(remote)], NOW);
    if (result.kind !== 'merged') throw new Error(result.kind);
    expect(result.data.deviceId).toBe('device-new');
    expect(result.data.users.map((u) => u.id)).toEqual(['user-a', 'user-b']);
    expect(result.data.categories).toHaveLength(12);
    expect(result.data.transactions).toHaveLength(1);
  });
});

describe('dataForJoin', () => {
  it('lấy dữ liệu từ thư mục, giữ deviceId của máy tham gia', () => {
    const { remote } = setup();
    const result = dataForJoin('device-new', [file(remote)], NOW);
    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.data.deviceId).toBe('device-new');
  });

  it('thư mục chưa có dữ liệu → báo lỗi', () => {
    expect(dataForJoin('device-new', [], NOW)).toMatchObject({
      kind: 'error',
      message: expect.stringContaining('Chưa thấy dữ liệu'),
    });
  });

  it('chỉ có file hỏng → báo lỗi kèm danh sách file lỗi', () => {
    const result = dataForJoin('device-new', [{ name: 'device-b.json', content: '{' }], NOW);
    expect(result.kind).toBe('error');
    expect(result.problems.map((p) => p.reason)).toEqual(['invalid']);
  });

  it('chỉ có file mã hóa mà chưa nhập mật khẩu → báo cần mật khẩu', () => {
    const result = dataForJoin(
      'device-new',
      [{ name: 'device-b.enc.json', reason: 'encrypted', message: '' }],
      NOW,
    );
    expect(result).toMatchObject({ kind: 'error', message: JOIN_NEEDS_PASSWORD_MESSAGE });
  });

  it('file của bản app mới hơn → báo cần cập nhật', () => {
    const { remote } = setup();
    const newer = JSON.stringify({ ...remote, schemaVersion: 2 });
    expect(
      dataForJoin('device-new', [{ name: 'device-b.json', content: newer }], NOW),
    ).toMatchObject({ kind: 'error', message: 'Máy kia đang dùng bản mới hơn, hãy cập nhật app.' });
  });
});

describe('connectProblem', () => {
  it('thư mục rỗng hoặc cùng gia đình → kết nối được', () => {
    const { local, remote } = setup();
    expect(connectProblem(local, [], NOW)).toBeNull();
    expect(connectProblem(local, [file(remote)], NOW)).toBeNull();
  });

  it('thư mục của gia đình khác → không cho kết nối', () => {
    const { local } = setup();
    expect(connectProblem(local, [file(otherHousehold())], NOW)).toContain('gia đình khác');
  });
});
