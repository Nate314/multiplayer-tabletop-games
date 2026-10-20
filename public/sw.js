// Service worker for the installed app. Files always come from the network when it answers, so a new build shows on
// the next reload; the last copy of each is kept so the app shell still opens offline. Games need the server, so
// the API and the WebSocket are never touched.
const CACHE = 'tabletop-games-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(new Request('/', { cache: 'no-cache' }))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !url.protocol.startsWith('http') || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  // "no-cache" makes the browser check with the server first instead of reusing its own copy
  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request.mode === 'navigate' ? '/' : request, { ignoreSearch: true })
        .then(cached => cached || Response.error())));
});
