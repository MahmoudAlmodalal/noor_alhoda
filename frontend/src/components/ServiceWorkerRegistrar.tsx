"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        if (cancelled) return;

        // Background Sync — wake the app when connectivity returns so the
        // outbox drains even if the tab was closed. Silently unsupported
        // on Firefox/Safari.
        const swWithSync = registration as ServiceWorkerRegistration & {
          sync?: { register(tag: string): Promise<void> };
        };
        if (swWithSync.sync && typeof swWithSync.sync.register === "function") {
          try {
            await swWithSync.sync.register("noor-sync-push");
          } catch (_err) {
            /* permission denied or unsupported — fall back to online events */
          }
        }
      } catch (error) {
        console.error("SW registration failed:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
