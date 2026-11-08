/// <reference types="vitest/config" />
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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

/** Thẻ chèn vào cuối `<head>`, sau `<meta charset>`. */
function headTag(tag: string, attrs: Record<string, string>): HtmlTagDescriptor {
  return { tag, attrs, injectTo: 'head' };
}

/** Các file trong `web-public/` (manifest, icon) mà service worker lưu sẵn. */
const WEB_PUBLIC_PRECACHE = ['manifest.webmanifest', 'apple-touch-icon.png', 'favicon.png'];

/**
 * Bản web thành app cài được vào Màn hình chính của iPhone (PWA): chèn manifest, icon và các thẻ
 * meta của Safari vào trang, và tạo `sw.js` từ khuôn `src/web/sw.js` với danh sách file của bản
 * build để mở được app khi không có mạng. index.html của app desktop không đổi.
 */
function webApp(): Plugin {
  return {
    name: 'family-budget-web-app',
    enforce: 'post',
    transformIndexHtml(html) {
      return {
        // viewport-fit=cover: nội dung trải tới mép màn hình, app tự chừa tai thỏ và thanh Home.
        html: html.replace(
          'width=device-width, initial-scale=1.0',
          'width=device-width, initial-scale=1.0, viewport-fit=cover',
        ),
        tags: [
          headTag('link', { rel: 'manifest', href: 'manifest.webmanifest' }),
          headTag('link', { rel: 'icon', type: 'image/png', href: 'favicon.png' }),
          headTag('link', { rel: 'apple-touch-icon', href: 'apple-touch-icon.png' }),
          headTag('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }),
          headTag('meta', { name: 'mobile-web-app-capable', content: 'yes' }),
          headTag('meta', { name: 'apple-mobile-web-app-title', content: 'Family Budget' }),
          headTag('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }),
          // Màu thật theo theme được đặt lại lúc chạy (platform/nativeWindow.web.ts).
          headTag('meta', { name: 'theme-color', content: '#e2ded5' }),
        ],
      };
    },
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((name) => name !== 'index.html' && !name.endsWith('.map'))
        .sort();
      const precache = ['./', ...WEB_PUBLIC_PRECACHE, ...files];
      const version = createHash('sha256').update(precache.join(' ')).digest('hex').slice(0, 12);
      const template = readFileSync('src/web/sw.js', 'utf8');
      const source = template
        .replace("const VERSION = '__VERSION__';", `const VERSION = ${JSON.stringify(version)};`)
        .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(precache)};`);
      if (source.includes('__PRECACHE__;') || source.includes("'__VERSION__';")) {
        this.error('src/web/sw.js: không tìm thấy dòng VERSION / PRECACHE để điền.');
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const web = mode === 'web';
  return {
    plugins: [react(), ...(web ? [webVariants(), webApp()] : [])],

    // Bản web: đường dẫn tương đối để chạy được ở thư mục con (GitHub Pages: /family_budget/).
    base: web ? './' : '/',
    publicDir: web ? 'web-public' : 'public',
    build: { outDir: web ? 'dist-web' : 'dist' },
    define: {
      __APP_VERSION__: JSON.stringify(
        (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version,
      ),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },

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
