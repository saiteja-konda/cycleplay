const CACHE_NAME = 'cycleplay-v15';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/app.js',
  '/src/api.js',
  '/src/gps.js',
  '/src/state.js',
  '/src/sync.js',
  '/src/voice.js',
  '/src/audio.js',
  '/src/weather.js',
  '/src/offline.js'
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
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCacheFallback(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse && networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

async function networkFirstWithCacheFallback(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.ok) {
      const method = request.method.toUpperCase();
      const url = new URL(request.url);

      // For mutation requests (POST, PUT, DELETE) on rides API, invalidate all cached GET responses
      if (method !== 'GET' && url.pathname.startsWith('/api/rides')) {
        const keys = await cache.keys();
        for (const key of keys) {
          if (key.method === 'GET' && key.url.startsWith(url.origin + '/api/rides')) {
            await cache.delete(key);
          }
        }
      }

      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    throw err;
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'sync-rides') {
    self.registration.sync.register('sync-rides')
      .then(() => console.log('Background Sync registered'))
      .catch(() => {});
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-rides') {
    event.waitUntil(syncPendingRides());
  }
});

async function syncPendingRides() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'background-sync' });
  });
}
