// Service worker của bản web. File này là khuôn: lúc build, plugin `webApp` trong vite.config.ts
// điền VERSION và PRECACHE (danh sách file của bản build) rồi ghi ra dist-web/sw.js.
//
// - Cài đặt: lưu sẵn mọi file của app vào cache, để mở được app khi không có mạng.
// - Mở trang: lấy trang mới trên mạng trước (có bản mới thì dùng luôn), mất mạng thì dùng bản
//   đã lưu. Các file khác (JS, CSS, font, ảnh) tên có mã băm nên lấy từ cache trước.
// - Chỉ xử lý yêu cầu GET cùng nguồn: yêu cầu tới Google Apps Script đi thẳng ra mạng.

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `family-budget-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('family-budget-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const page = self.registration.scope;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(page, copy));
          }
          return response;
        })
        .catch(() => caches.match(page).then((cached) => cached || Response.error())),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
