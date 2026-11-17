// Exists only so Chrome/Android treats this as an installable app (one of
// the install criteria). Deliberately does no caching — every request just
// goes straight to the network, so there's no risk of serving stale data
// or a stale build for this live app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Web Push: shows the OS-level notification banner even when the app
// isn't open. Payload is set by the send-push edge function.
self.addEventListener('push', (event) => {
  let data = { title: 'Red Solutions Shop', body: 'You have an update.' };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // ignore malformed payloads
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/feedback');
    })
  );
});
