const CACHE_NAME = "sff-call-sheet-v2";

const APP_STATIC_RESOURCES = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_STATIC_RESOURCES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();

          if (
            request.url.startsWith(self.location.origin) &&
            networkResponse.ok
          ) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          return caches.match("/");
        });
    })
  );
});
