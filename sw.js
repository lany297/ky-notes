const CACHE_NAME = "ky-notes-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal, cache: "no-cache" })
    .finally(() => clearTimeout(timer));
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Never intercept cross-origin API calls (Gitee / GitHub sync)
  if (url.origin !== self.location.origin) return;

  const isNav = event.request.mode === "navigate";
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true })
        || (isNav ? await cache.match("./index.html", { ignoreSearch: true }) : null);

      const bgUpdate = fetchWithTimeout(event.request, 5000)
        .then((res) => {
          if (res && res.ok) {
            cache.put(event.request, res.clone());
            if (isNav) {
              cache.put("./index.html", res.clone());
              cache.put("./", res.clone());
            }
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(bgUpdate);
        return cached;
      }

      const fresh = await bgUpdate;
      if (fresh) return fresh;
      return (await cache.match("./index.html", { ignoreSearch: true })) || Response.error();
    })
  );
});
