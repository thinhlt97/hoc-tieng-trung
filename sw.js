/* sw.js — Service worker cho PWA "Học tiếng Trung".
 * Mục tiêu: cài về điện thoại + chạy offline (dữ liệu từ vựng đã nằm trong data/hsk.js).
 * Chiến lược:
 *  - App shell (HTML/JS/icon) : network-first, fallback cache (luôn lấy bản mới khi có mạng).
 *  - Font Google + CDN (Hanzi Writer): cache-first, lưu khi tải lần đầu để dùng offline.
 *  - API (vocab-worker đồng bộ, proxy ví dụ AI): KHÔNG cache — luôn ra mạng.
 * Đổi CACHE_VER mỗi lần sửa danh sách hoặc muốn ép làm mới cache.
 */
const CACHE_VER = "zh-v26";
const CORE = "core-" + CACHE_VER;
const RUNTIME = "runtime-" + CACHE_VER;

// Tài nguyên cùng gốc cần có sẵn để mở offline.
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./data/hsk.js",
  "./data/grammar.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

// Các host chỉ cache "âm thầm" khi runtime gọi tới (font, thư viện CDN).
const RUNTIME_HOSTS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CORE).then(c => c.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CORE && k !== RUNTIME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // API đồng bộ / proxy AI: luôn ra mạng, không đụng cache.
  if (/zh-vocab-worker|workers\.dev|vercel\.app/.test(url.host) &&
      !RUNTIME_HOSTS.includes(url.host)) {
    return; // để trình duyệt xử lý mặc định
  }

  // Tài nguyên cùng gốc: network-first (ưu tiên bản mới), fallback cache.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CORE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(m => m || caches.match("./index.html")))
    );
    return;
  }

  // Font + CDN: cache-first.
  if (RUNTIME_HOSTS.includes(url.host)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit))
    );
  }
});
