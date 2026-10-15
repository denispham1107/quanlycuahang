const CACHE_VERSION = "quanlycuahang-pwa-v168";
const SDK_CACHE = "quanlycuahang-firebase-sdk-10.12.5";
const FIREBASE_SDK_PREFIX = "https://www.gstatic.com/firebasejs/10.12.5/";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=168",
  "./firebase-loader.js?v=168",
  "./cloud-sync-core.js?v=168",
  "./app.js?v=168",
  "./closing-book-core.js?v=168",
  "./closing-book.js?v=168",
  "./firebase-config.js",
  "./manifest.webmanifest?v=168",
  "./icons/settings-flat-v1.webp",
  "./icons/icon-v3.svg",
  "./icons/icon-v3-192.png",
  "./icons/icon-v3-512.png",
  "./icons/icon-v3-maskable-512.png",
  "./icons/apple-touch-icon-v3.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(async keys => {
        const sdk = await caches.open(SDK_CACHE);
        const oldKeys = keys.filter(key => key.startsWith("quanlycuahang-pwa-") && key !== CACHE_VERSION);
        // Retain SDK downloads across app releases, including migration from older shell caches.
        for (const key of oldKeys) {
          const old = await caches.open(key);
          for (const request of await old.keys()) {
            if (!request.url.startsWith(FIREBASE_SDK_PREFIX)) continue;
            const response = await old.match(request);
            if (response) await sdk.put(request, response);
          }
        }
        await Promise.all(oldKeys.map(key => caches.delete(key)));
      })
      .then(() => self.clients.claim())
  );
});

function refreshAppAsset(request) {
  return fetch(request, { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) return response;
      const responseCopy = response.clone();
      return caches.open(CACHE_VERSION)
        .then((cache) => cache.put(request, responseCopy))
        .catch(() => {})
        .then(() => response);
    })
    .catch(() => null);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (request.destination === "script" && requestUrl.href.startsWith(FIREBASE_SDK_PREFIX)) {
    // Retry query strings bypass a hung HTTP request but all attempts share the pinned SDK cache.
    const sdkCacheUrl = requestUrl.origin + requestUrl.pathname;
    event.respondWith(
      caches.match(sdkCacheUrl).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok || response.type === "opaque") {
          const responseCopy = response.clone();
          return caches.open(SDK_CACHE)
            .then((cache) => cache.put(sdkCacheUrl, responseCopy))
            .catch(() => {})
            .then(() => response);
        }
        return response;
      }))
    );
    return;
  }
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const networkResponse = refreshAppAsset(request);
    event.waitUntil(networkResponse);
    event.respondWith(
      caches.match(request)
        .then((cached) => cached || caches.match("./index.html"))
        .then((cached) => cached || networkResponse.then((response) => response || Response.error()))
    );
    return;
  }

  // Never hold the launch behind a slow connection when a cached UI asset exists.
  if (request.destination === "style" || request.destination === "script") {
    const networkResponse = refreshAppAsset(request);
    event.waitUntil(networkResponse);
    event.respondWith(
      caches.match(request)
        .then((cached) => cached || networkResponse.then((response) => response || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkResponse = fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseCopy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseCopy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkResponse;
    })
  );
});
