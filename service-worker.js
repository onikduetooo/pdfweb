const CACHE_VERSION = 'pixelpress-v40';
const RUNTIME_CACHE = 'pixelpress-runtime-v40';

const CORE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './pdf-worker.js',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(
      CORE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_VERSION && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => {
      try { client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION }); } catch (e) {}
    });
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;
  if (url.pathname.endsWith('.pdf')) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      try {
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) {
          const copy = preloadResponse.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return preloadResponse;
        }
        const networkRes = await fetch(req);
        const copy = networkRes.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return networkRes;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        const index = await caches.match('./index.html');
        if (index) return index;
        const root = await caches.match('./');
        if (root) return root;
        return new Response('<!DOCTYPE html><html><head><meta charset="utf-8"><title>PixelPress</title><style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#fff;color:#1d1d1f;text-align:center;padding:24px}button{padding:12px 24px;border:0;border-radius:999px;background:#34c759;color:#fff;font-weight:500;font-size:15px;cursor:pointer}</style></head><body><div><h1>PixelPress</h1><p>You are offline.</p><button onclick="location.reload()">Retry</button></div></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
        }
      }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});