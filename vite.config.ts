/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import process from 'node:process';

const host = process.env.TAURI_DEV_HOST;

/**
 * Bản web (`--mode web`, chạy trên điện thoại): file nào có bản `<tên>.web.ts(x)` cùng thư mục
 * thì dùng bản đó thay cho bản desktop, ví dụ `storage/localStore.web.ts` lưu vào IndexedDB thay
 * cho file trên máy. Import thẳng gói `@tauri-apps/*` thì báo lỗi build, để không có đoạn code
 * nào của Tauri lọt vào bản web.
 */
function webVariants(): Plugin {
  return {
    name: 'family-budget-web-variants',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || importer.includes('/node_modules/')) return null;
      if (source.startsWith('@tauri-apps/')) {
        this.error(`Bản web không dùng được ${source} (import trong ${importer}).`);
      }
      if (!source.startsWith('.') && !source.startsWith('/')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      const match = resolved && /^(.*)\.(tsx?)$/.exec(resolved.id);
      if (!match) return null;
      const variant = `${match[1]}.web.${match[2]}`;
      // Bản web có thể import lại bản desktop cùng tên (ví dụ để dùng chung kiểu dữ liệu).
      if (importer === variant || !existsSync(variant)) return null;
      return variant;
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const web = mode === 'web';
  return {
    plugins: [react(), ...(web ? [webVariants()] : [])],

    build: { outDir: web ? 'dist-web' : 'dist' },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    //    (bản web chạy cổng riêng để mở được cùng lúc với `tauri dev`)
    server: {
      port: web ? 1430 : 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: 'ws',
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // 3. tell Vite to ignore watching `src-tauri`
        ignored: ['**/src-tauri/**'],
      },
    },

    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  };
});
