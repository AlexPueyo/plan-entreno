/* Plan de Alex — service worker.
   Every same-origin GET is network-first, then stored for offline.
   That includes data/*.json, so a weekly edit shows on the next open
   instead of sticking to a stale cache. If the network fails, the
   precached copy is used. */

const CACHE = "plan-alex-v4";

const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./data/semana-actual.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

async function put(request, response) {
  try {
    if (!response || !response.ok) return;
    const cache = await caches.open(CACHE);
    await cache.put(new Request(request.url), response.clone());
  } catch (err) {
    /* A failed cache write must not hide a good network response. */
  }
}

async function matchCached(request) {
  const cache = await caches.open(CACHE);
  const url = new URL(request.url);
  const indexUrl = new URL("./index.html", self.registration.scope).href;
  const rootUrl = new URL("./", self.registration.scope).href;
  const candidates = [request, url.href, url.origin + url.pathname];
  if (request.mode === "navigate") candidates.push(indexUrl, rootUrl);
  for (const candidate of candidates) {
    const hit = await cache.match(candidate);
    if (hit) return hit;
  }
  return undefined;
}

async function networkFirst(request) {
  try {
    // Bypass the browser HTTP cache so a weekly JSON edit is visible immediately.
    const fresh = await fetch(request.url, {
      cache: "no-store",
      credentials: request.credentials,
      redirect: "follow",
    });
    await put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await matchCached(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  event.respondWith(networkFirst(request));
});
