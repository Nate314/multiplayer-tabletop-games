// Service worker for the installed app. Files always come from the network when it answers, so a new build shows on
// the next reload; the last copy of each is kept so the app shell still opens offline. Games need the server, so
// the API and the WebSocket are never touched.
const CACHE = 'tabletop-games-v2';

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
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request.mode === 'navigate' ? '/' : request, { ignoreSearch: true })
        .then(cached => cached || Response.error())));
});

const FALLBACK = { title: 'Something is waiting for you', body: '', tag: 'tabletop-games', url: '/' };
const gameOf = client => new URL(client.url).searchParams.get('game');

// The server decides what is worth saying for this subscription; a window already showing that game needs no alert.
// Every step is guarded because the browser requires a visible notification for each push.
async function alertsToShow() {
  try {
    const subscription = await self.registration.pushManager.getSubscription();
    if (!subscription) return [FALLBACK];
    const response = await fetch('/api/push/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    const { alerts } = await response.json();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const watched = new Set(windows.filter(client => client.visibilityState === 'visible').map(gameOf));
    // only a game the player is looking at silences a push; an empty answer still needs something visible
    return alerts.length ? alerts.filter(alert => !watched.has(alert.tag)) : [FALLBACK];
  } catch {
    return [FALLBACK];
  }
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    await Promise.all((await alertsToShow()).map(({ title, body, tag, url }) =>
      self.registration.showNotification(title, {
        body, tag, renotify: true, icon: '/icon-192.png', badge: '/icon-192.png', data: { url, tag },
      })));
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const { url, tag } = event.notification.data || {};
  event.waitUntil((async () => {
    const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(client => new URL(client.url).origin === self.location.origin);
    const target = windows.find(client => gameOf(client) === tag) || windows[0];
    if (target) return target.focus();
    return self.clients.openWindow(url || '/');
  })().catch(() => {}));
});
