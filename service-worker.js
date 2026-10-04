const CACHE_VERSION = "quanlycuahang-pwa-v51";
const FIREBASE_SDK_PREFIX = "https://www.gstatic.com/firebasejs/10.12.5/";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=51",
  "./app.js?v=51",
  "./firebase-config.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
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
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
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
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok || response.type === "opaque") {
          const responseCopy = response.clone();
          return caches.open(CACHE_VERSION)
            .then((cache) => cache.put(request, responseCopy))
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
