/* Service Worker: network-first con fallback a caché para uso offline básico.
   Nunca sirve contenido cacheado si hay red disponible, para evitar versiones antiguas. */
const CACHE_NAME = 'todooficios-v1';
const OFFLINE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(OFFLINE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, response.clone());
      return response;
    } catch (err) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
      throw err;
    }
  })());
});
