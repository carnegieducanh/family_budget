import { describe, expect, it, vi } from 'vitest';
import { readRemoteFiles } from '../sync/syncService';
import {
  callScript,
  createScriptAdapter,
  type CachedFiles,
  type FetchFn,
  type RemoteFileCache,
} from './scriptAdapter';

const CONNECTION = { url: 'https://script.google.com/macros/s/abc/exec', key: 'secret' };

/** fetch giả trả về `body` dạng JSON (hoặc chuỗi thô). */
function fakeFetch(body: unknown, status = 200) {
  return vi.fn<FetchFn>(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

function sentBody(fetchFn: ReturnType<typeof fakeFetch>, call = 0): Record<string, unknown> {
  const init = fetchFn.mock.calls[call]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe('callScript', () => {
  it('gửi POST dạng chuỗi (không header, khỏi hỏi trước CORS) kèm mã kết nối', async () => {
    const fetchFn = fakeFetch({ ok: true, files: [] });
    await callScript(CONNECTION, { action: 'list' }, fetchFn);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe(CONNECTION.url);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toBeUndefined();
    expect(typeof init?.body).toBe('string');
    expect(sentBody(fetchFn)).toEqual({ action: 'list', key: 'secret' });
  });

  it('script báo lỗi → ném đúng thông báo của script', async () => {
    const fetchFn = fakeFetch({ ok: false, error: 'Sai mã kết nối.' });
    await expect(callScript(CONNECTION, { action: 'list' }, fetchFn)).rejects.toThrow(
      'Sai mã kết nối.',
    );
  });

  it('link không phải script (trả về trang HTML) → báo link sai', async () => {
    const fetchFn = fakeFetch('<html>Đăng nhập</html>');
    await expect(callScript(CONNECTION, { action: 'list' }, fetchFn)).rejects.toThrow(
      'Link kết nối không phải ứng dụng web Family Budget',
    );
  });

  it('lỗi HTTP và lỗi mạng → thông báo tiếng Việt', async () => {
    await expect(callScript(CONNECTION, {}, fakeFetch({}, 404))).rejects.toThrow('HTTP 404');
    const offline = vi.fn<FetchFn>(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(callScript(CONNECTION, {}, offline)).rejects.toThrow(
      'Không kết nối được tới Google Apps Script',
    );
  });
});

describe('createScriptAdapter', () => {
  const A = 'device-aaaa.json';
  const B = 'device-bbbb.json';

  it('một lần gọi list lấy cả tên lẫn nội dung file của máy khác, bỏ file của máy này', async () => {
    const fetchFn = fakeFetch({
      ok: true,
      files: [
        { name: B, content: '{"b":1}' },
        { name: A, content: '{"a":1}' },
        { name: 'device-me.json', content: '{"me":1}' },
        { name: 'ghi-chu.txt', content: 'x' },
      ],
    });
    const adapter = createScriptAdapter(CONNECTION, 'me', { fetchFn });
    expect(await readRemoteFiles(adapter)).toEqual([
      { name: A, content: '{"a":1}' },
      { name: B, content: '{"b":1}' },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchFn)).toMatchObject({ action: 'list', exclude: 'me' });
  });

  it('ghi file của máy này với tên device-<mã máy>.json', async () => {
    const fetchFn = fakeFetch({ ok: true });
    const adapter = createScriptAdapter(CONNECTION, 'me', { fetchFn });
    await adapter.writeOwn('{"deviceId":"me"}');
    expect(sentBody(fetchFn)).toEqual({
      action: 'write',
      name: 'device-me.json',
      content: '{"deviceId":"me"}',
      key: 'secret',
    });
  });

  it('ghi lỗi → ném lỗi để lượt sync báo', async () => {
    const adapter = createScriptAdapter(CONNECTION, 'me', {
      fetchFn: fakeFetch({ ok: false, error: 'Nội dung không khớp tên file.' }),
    });
    await expect(adapter.writeOwn('{}')).rejects.toThrow('Nội dung không khớp tên file.');
  });
});

describe('exchange (một lần gọi, chỉ nhận file đã đổi)', () => {
  const A = 'device-aaaa.json';
  const B = 'device-bbbb.json';

  /** Bản sao trong bộ nhớ thay cho IndexedDB. */
  function memoryCache(initial: CachedFiles | null = null) {
    const store = { value: initial };
    const cache: RemoteFileCache = {
      load: async () => store.value,
      save: async (files) => {
        store.value = files;
      },
    };
    return { store, cache };
  }

  /** fetch giả trả lời theo từng yêu cầu. */
  function scriptFetch(reply: (body: Record<string, unknown>) => unknown) {
    return vi.fn<FetchFn>(async (_url, init) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return new Response(JSON.stringify(reply(body)));
    });
  }

  it('gửi file của máy này và danh sách file đã có; file không đổi lấy từ bản sao', async () => {
    const { store, cache } = memoryCache({
      url: CONNECTION.url,
      files: { [A]: { modified: 't1', content: '{"a":1}' } },
    });
    const fetchFn = scriptFetch(() => ({
      ok: true,
      files: [
        { name: A, modified: 't1', unchanged: true },
        { name: B, modified: 't5', content: '{"b":2}' },
      ],
    }));
    const adapter = createScriptAdapter(CONNECTION, 'me', { fetchFn, cache });

    expect(await adapter.exchange!('{"deviceId":"me"}')).toEqual([
      { name: A, content: '{"a":1}' },
      { name: B, content: '{"b":2}' },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchFn)).toEqual({
      action: 'sync',
      exclude: 'me',
      known: { [A]: 't1' },
      name: 'device-me.json',
      content: '{"deviceId":"me"}',
      key: 'secret',
    });
    expect(store.value).toEqual({
      url: CONNECTION.url,
      files: {
        [A]: { modified: 't1', content: '{"a":1}' },
        [B]: { modified: 't5', content: '{"b":2}' },
      },
    });
  });

  it('không có gì để ghi thì chỉ đọc; bản sao của kết nối khác không được dùng', async () => {
    const { cache } = memoryCache({
      url: 'https://script.google.com/macros/s/khac/exec',
      files: { [A]: { modified: 't1', content: 'cũ' } },
    });
    const fetchFn = scriptFetch(() => ({ ok: true, files: [] }));
    await createScriptAdapter(CONNECTION, 'me', { fetchFn, cache }).exchange!(null);
    const body = sentBody(fetchFn);
    expect(body.known).toEqual({});
    expect(body).not.toHaveProperty('content');
    expect(body).not.toHaveProperty('name');
  });

  it('script bản cũ (chưa có yêu cầu sync): ghi rồi đọc bằng 2 lần gọi như trước', async () => {
    const fetchFn = scriptFetch((body) =>
      body.action === 'sync'
        ? { ok: false, error: 'Yêu cầu không hợp lệ.' }
        : body.action === 'write'
          ? { ok: true }
          : { ok: true, files: [{ name: B, content: '{"b":2}' }] },
    );
    const adapter = createScriptAdapter(CONNECTION, 'me', { fetchFn });
    expect(await adapter.exchange!('{"deviceId":"me"}')).toEqual([{ name: B, content: '{"b":2}' }]);
    expect(fetchFn.mock.calls.map(([, init]) => JSON.parse(String(init.body)).action)).toEqual([
      'sync',
      'write',
      'list',
    ]);
  });

  it('lỗi khác của script (ví dụ sai mã) không chuyển sang cách cũ', async () => {
    const fetchFn = scriptFetch(() => ({ ok: false, error: 'Sai mã kết nối.' }));
    const adapter = createScriptAdapter(CONNECTION, 'me', { fetchFn });
    await expect(adapter.exchange!(null)).rejects.toThrow('Sai mã kết nối.');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
