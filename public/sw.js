const CACHE_NAME = "sff-call-sheet-v3";

const APP_STATIC_RESOURCES = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
];

const AUTH_PATH_PREFIXES = [
  "/login",
  "/auth",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_STATIC_RESOURCES)
    )
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

function isAuthRequest(url) {
  return AUTH_PATH_PREFIXES.some(
    (prefix) =>
      url.pathname === prefix ||
      url.pathname.startsWith(`${prefix}/`)
  );
}

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

async function handleNavigationRequest(request) {
  const url = new URL(request.url);

  // Authentication pages must always go directly to the network.
  // This prevents Safari/iPad from receiving cached redirect responses.
  if (isAuthRequest(url)) {
    return fetch(request);
  }

  try {
    const networkResponse = await fetch(request);

    // Never cache redirects.
    if (
      networkResponse.ok &&
      !networkResponse.redirected &&
      networkResponse.status === 200 &&
      url.origin === self.location.origin
    ) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Offline fallback for pages that were previously loaded successfully.
    const cachedPage = await caches.match(request);

    if (cachedPage) {
      return cachedPage;
    }

    // Last-resort offline shell if root was previously cached successfully.
    const cachedRoot = await caches.match("/");

    if (cachedRoot) {
      return cachedRoot;
    }

    throw error;
  }
}

async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (
      networkResponse.ok &&
      !networkResponse.redirected &&
      networkResponse.status === 200 &&
      request.url.startsWith(self.location.origin)
    ) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Never intercept Supabase or any third-party request.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept auth endpoints.
  if (isAuthRequest(url)) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleAssetRequest(request));
});
