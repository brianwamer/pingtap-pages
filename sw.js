// ---- PingTap SW (GitHub Pages /pingtap-pages 用) ----
const VERSION = 'v1.0.3';               // ←更新時は上げる
const SCOPE   = '/pingtap-pages/';
const STATIC_CACHE = `pt-static-${VERSION}`;
const RUNTIME_CACHE = `pt-runtime-${VERSION}`;

// できるだけ列挙を減らし、動的キャッシュで賄う方針。
// HTMLは network-first（更新拾う）、その他は cache-first。
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(STATIC_CACHE);
    await c.addAll([
      `${SCOPE}index.html`,
      `${SCOPE}manifest.webmanifest`
      // 画像や音は動的キャッシュに任せる
    ]);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
      .map(k => caches.delete(k)));
  })());
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // このPWAのスコープ外は触らない
  if (!url.pathname.startsWith(SCOPE)) return;

  const isHTML = e.request.mode === 'navigate' || e.request.destination === 'document';

  if (isHTML) {
    // HTMLは network-first
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request, { cache: 'no-store' });
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(e.request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(e.request);
        return cached ?? caches.match(`${SCOPE}index.html`);
      }
    })());
  } else {
    // 画像・フォント・JS/CSSは cache-first（なければネット→保存）
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      try {
        const res = await fetch(e.request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(e.request, res.clone());
        return res;
      } catch {
        return caches.match(`${SCOPE}index.html`);
      }
    })());
  }
});

// 手動更新用（必要ならクライアントから postMessage('update')）
self.addEventListener('message', (e) => {
  if (e.data === 'update') self.skipWaiting();
});