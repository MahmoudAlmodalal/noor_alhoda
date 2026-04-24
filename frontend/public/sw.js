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

const CACHE_VERSION = "v6";
const APP_CACHE = `noor-alhuda-${CACHE_VERSION}`;
const RUNTIME_CACHE = `noor-alhuda-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/login",
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
      // Fetch each URL individually so a 404 on one asset doesn't abort
      // the whole install (e.g., an icon missing in a branch build).
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "same-origin" });
            if (res.ok) await cache.put(url, res.clone());
          } catch (_err) {
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

  // Never intercept API calls — let them reach the network (or fail fast
  // so the app can fall back to IndexedDB).
  if (url.pathname.startsWith("/api/")) return;

  // Cross-origin requests: let the browser handle.
  if (url.origin !== self.location.origin) return;

  // Hashed static assets — cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Navigation requests — network-first, fallback to precache / root shell.
  if (req.mode === "navigate") {
    event.respondWith(navigationHandler(req));
    return;
  }

  // Other same-origin GETs (manifest, icons, fonts) — stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(req));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "noor-sync-push") {
    event.waitUntil(broadcastTriggerPush());
  }
});

// Allow the page to force-activate a new SW after update, and to request
// background route warm-up so navigation-capable cached responses exist
// for a cold-start offline session.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type === "WARM_ROUTES" && Array.isArray(data.urls)) {
    event.waitUntil(warmRoutes(data.urls));
  }
});

async function warmRoutes(urls) {
  const cache = await caches.open(RUNTIME_CACHE);
  // Sequential with small concurrency — avoid hammering the server.
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, {
          credentials: "same-origin",
          // Mark as navigation so the network-first handler doesn't try to
          // re-cache what we're already about to cache here.
          headers: { "X-Warm-Route": "1" },
        });
        if (res.ok && res.status === 200) {
          await cache.put(url, res.clone());
        }
      } catch (_err) {
        /* silent — we'll retry next login */
      }
    })
  );
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
  } catch (_err) {
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
  } catch (_err) {
    // Offline — serve a cached navigation if we have one; otherwise the
    // root shell so React's client router can render the target route
    // from IndexedDB.
    const runtime = await caches.open(RUNTIME_CACHE);
    const cachedRoute = await runtime.match(req);
    if (cachedRoute) return cachedRoute;
    const rootShell = await caches.match("/");
    if (rootShell) return rootShell;
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
