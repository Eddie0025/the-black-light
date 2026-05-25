// No‑op Service Worker – prevents old caching
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
// No fetch handling – pages will be served directly from network
