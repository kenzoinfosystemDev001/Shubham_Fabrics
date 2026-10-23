const CACHE_NAME = 'shubham-mes-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/shubham-logo.jpg',
  '/logo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA: Some assets could not be cached:', err);
      });
    })
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
  const url = event.request.url;

  // CRITICAL: Never intercept non-GET requests (POST, PUT, DELETE, PATCH).
  // Returning without calling event.respondWith() lets the browser handle them natively.
  if (event.request.method !== 'GET') {
    return;
  }

  // Never cache API calls — always go to network.
  if (url.includes('/api/')) {
    return;
  }

  // For GET non-API requests: network-first, fall back to cache.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Only cache valid same-origin responses.
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Return a proper offline fallback response — never return undefined.
          return new Response('Offline - resource not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});
