// Exists only so Chrome/Android treats this as an installable app (one of
// the install criteria). Deliberately does no caching — every request just
// goes straight to the network, so there's no risk of serving stale data
// or a stale build for this live app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
