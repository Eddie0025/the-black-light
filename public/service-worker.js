// This service worker self-destructs: clears all caches and unregisters itself.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(cacheNames.map(c => caches.delete(c))))
      .then(() => self.registration.unregister())
  );
});
