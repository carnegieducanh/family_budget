import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useUpdateStore, type InstallState } from '../state/updateStore';
import { flushWrites } from '../storage/localStore';

// Cập nhật app (SPEC mục 9) qua plugin-updater: kiểm tra khi mở app và mỗi 24 giờ; có bản mới
// thì hiện banner, chỉ tải và cài khi người dùng bấm "Cập nhật". Bản cập nhật được ký bằng
// khóa của Tauri; plugin từ chối file có chữ ký sai hoặc không khớp số phiên bản.

export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Bản mới tìm thấy ở lần kiểm tra gần nhất (giữ tài nguyên phía Rust để tải về). */
let pending: Update | null = null;
let checking: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setInstall(install: InstallState): void {
  useUpdateStore.setState({ install });
}

function installing(): boolean {
  const { phase } = useUpdateStore.getState().install;
  return phase === 'downloading' || phase === 'installing';
}

/** Kiểm tra bản mới. Lỗi (mất mạng...) được ghi vào store, không ném ra. */
export function checkForUpdate(): Promise<void> {
  if (installing()) return Promise.resolve();
  checking ??= (async () => {
    useUpdateStore.setState({ checking: true });
    try {
      const update = await check();
      const previous = pending;
      pending = update;
      previous?.close().catch(() => undefined);
      useUpdateStore.setState({
        available: update ? { version: update.version, notes: update.body?.trim() ?? '' } : null,
        lastCheck: { at: new Date().toISOString(), error: null },
        // Lỗi cài đặt lần trước thuộc về bản đã kiểm tra trước đó.
        install: { phase: 'idle' },
      });
    } catch (error) {
      console.warn('Không kiểm tra được cập nhật:', error);
      useUpdateStore.setState({
        lastCheck: { at: new Date().toISOString(), error: errorMessage(error) },
      });
    } finally {
      useUpdateStore.setState({ checking: false });
      checking = null;
    }
  })();
  return checking;
}

/** Nút "Cập nhật": tải, cài rồi khởi động lại app. */
export async function installUpdate(): Promise<void> {
  const update = pending;
  if (!update || installing()) return;
  let downloaded = 0;
  let total: number | null = null;
  setInstall({ phase: 'downloading', downloaded, total });
  try {
    await update.download((event) => {
      if (event.event === 'Started') total = event.data.contentLength ?? null;
      if (event.event === 'Progress') downloaded += event.data.chunkLength;
      setInstall({ phase: 'downloading', downloaded, total });
    });
    setInstall({ phase: 'installing' });
    // Trên Windows, install() mở trình cài đặt rồi thoát app ngay: ghi xong data.json trước.
    await flushWrites();
    await update.install();
    // macOS: bản mới đã thay vào thư mục app, khởi động lại để chạy bản mới.
    await relaunch();
  } catch (error) {
    setInstall({ phase: 'failed', message: errorMessage(error) });
  }
}

/** Gọi một lần khi mở app: đọc phiên bản, kiểm tra ngay và hẹn kiểm tra mỗi 24 giờ. */
export function startUpdateChecks(): void {
  if (timer !== undefined) return;
  getVersion().then(
    (currentVersion) => useUpdateStore.setState({ currentVersion }),
    (error: unknown) => console.warn('Không đọc được phiên bản app:', error),
  );
  void checkForUpdate();
  timer = setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
}

// Khi dev sửa code (HMR), dừng lịch cũ để không có 2 lịch chạy song song.
import.meta.hot?.dispose(() => {
  clearInterval(timer);
  timer = undefined;
});
