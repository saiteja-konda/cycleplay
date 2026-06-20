const CACHE_NAME = 'cycleplay-v13';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/app.js',
  '/src/api.js',
  '/src/gps.js',
  '/src/state.js',
  '/src/sync.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Do not cache API requests
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if found, else fetch from network
      return cachedResponse || fetch(event.request);
    })
  );
});
