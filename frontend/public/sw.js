/**
 * Noor Al-Huda service worker v3.
 *
 * - Precaches the login/root shell + icons so a cold-start works even when
 *   the device is offline. Auth-gated routes are NOT precached — they'd
 *   otherwise cache a redirect to /login. Navigation requests for those
 *   routes fall back to the root shell so React's client router can take
 *   over.
 * - /api/* is intentionally passed through to the network. IndexedDB is
 *   the offline source of truth for domain data; /api/sync/* must reach
 *   the server when online and fail fast when offline.
 * - Static assets under /_next/static/* are cache-first (content-hashed).
 * - Background Sync tag `noor-sync-push` wakes any open client with a
 *   postMessage so the push runner drains the outbox.
 */

const CACHE_VERSION = "v7";
const APP_CACHE = `noor-alhuda-${CACHE_VERSION}`;
const RUNTIME_CACHE = `noor-alhuda-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/login",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-256x256.png",
  "/icons/icon-384x384.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then(async (cache) => {
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "same-origin" });
            if (res.ok) await cache.put(url, res.clone());
          } catch {
            /* swallow — we'll retry at runtime */
          }
        })
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("noor-alhuda-") && n !== APP_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.pathname.startsWith("/api/")) return;

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(navigationHandler(req));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "noor-sync-push") {
    event.waitUntil(broadcastTriggerPush());
  }
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type === "WARM_ROUTES" && Array.isArray(data.urls)) {
    event.waitUntil(warmRoutes(data.urls, event.source));
  }
});

async function warmRoutes(urls, client) {
  const cache = await caches.open(RUNTIME_CACHE);
  let successCount = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, {
          credentials: "same-origin",
          headers: { "X-Warm-Route": "1" },
        });
        if (res.ok && res.status === 200) {
          await cache.put(url, res.clone());
          successCount++;
        }
      } catch {
        /* silent — we'll retry next login */
      }
    })
  );
  if (client) {
    client.postMessage({
      type: "WARM_ROUTES_COMPLETE",
      success: successCount > 0,
      successCount,
      totalCount: urls.length,
    });
  }
}

async function broadcastTriggerPush() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const c of clients) {
    c.postMessage({ type: "TRIGGER_PUSH" });
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response("", { status: 504 });
  }
}

async function navigationHandler(req) {
  try {
    const res = await fetch(req);
    if (res.ok && res.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const url = new URL(req.url);
    const runtime = await caches.open(RUNTIME_CACHE);
    const appCache = await caches.open(APP_CACHE);

    // 1. Exact cached route
    const cachedRoute = (await runtime.match(req)) || (await appCache.match(req));
    if (cachedRoute) return cachedRoute;

    // 2. Normalized pathname (e.g. without trailing query params)
    const normalized = await runtime.match(url.pathname);
    if (normalized) return normalized;

    // 3. Cached root shell
    const rootShell = (await appCache.match("/")) || (await runtime.match("/"));
    if (rootShell) return rootShell;

    // 4. Custom offline HTML fallback
    const offlineHtml = await appCache.match("/offline.html");
    if (offlineHtml) return offlineHtml;

    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}
