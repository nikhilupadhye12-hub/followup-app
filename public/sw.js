const CACHE_NAME = 'follow-up-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Offline-first for the app shell, network for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // never cache API
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ---- Push notifications ----
self.addEventListener('push', (event) => {
  let data = { title: 'Follow Up', body: 'You have a reminder.' };
  try { data = event.data.json(); } catch (e) { if (event.data) data.body = event.data.text(); }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientsArr => {
      const hadWindow = clientsArr.find(c => c.url.includes(self.location.origin));
      if (hadWindow) return hadWindow.focus();
      return self.clients.openWindow('/');
    })
  );
});
