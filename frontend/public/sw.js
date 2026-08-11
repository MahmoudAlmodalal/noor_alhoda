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

const CACHE_VERSION = "v8";
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

    // 4. Custom offline HTML fallback, searched across every cache
    const offlineHtml = await caches.match("/offline.html");
    if (offlineHtml) return offlineHtml;

    return new Response(OFFLINE_FALLBACK_HTML, {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>نور الهدى - غير متصل بالإنترنت</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1rem; box-sizing: border-box; font-family: system-ui, sans-serif; background: linear-gradient(104deg, #eff6ff, #fff7ed); color: #1e293b; text-align: center; }
      main { width: min(100%, 28rem); padding: 2rem; box-sizing: border-box; border-radius: 1rem; background: #fff; box-shadow: 0 10px 25px -5px rgb(0 0 0 / 10%); }
      h1 { margin: 0 0 .75rem; color: #0f172a; font-size: 1.5rem; }
      p { margin: 0 0 1.5rem; color: #64748b; line-height: 1.7; }
      button { border: 0; border-radius: .5rem; padding: .75rem 1.5rem; background: #2563eb; color: #fff; font: inherit; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>لا يوجد اتصال بالإنترنت</h1>
      <p>تعذر تحميل هذه الصفحة حالياً. أعد المحاولة عند عودة الاتصال بالإنترنت.</p>
      <button type="button" onclick="location.reload()">إعادة المحاولة</button>
    </main>
  </body>
</html>`;

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
