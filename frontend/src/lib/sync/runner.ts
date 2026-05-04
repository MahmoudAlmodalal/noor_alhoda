/**
 * Sync runner: drives pull + push loops. Runs on app boot, on `online`
 * events, on window `focus`, on a 30s heartbeat while the page is
 * visible, and on SW background-sync wakeups (via postMessage). Only
 * runs after the user has unlocked their DB session.
 */
import { hasSessionKey } from "../db/auth";

import { requeueErroredOps, revertStaleInFlight } from "./outbox";
import { pullSync } from "./pull";
import { triggerPush } from "./push";

const HEARTBEAT_MS = 30_000;

let started = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let swMessageHandler: ((ev: MessageEvent) => void) | null = null;

async function maybeSync(): Promise<void> {
  if (!hasSessionKey()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  // Push first so local edits hit the server before we pull new state —
  // reduces the chance of a fresh pull overwriting a pending edit with
  // stale server data.
  await triggerPush();
  await pullSync();
}

export function startSyncRunner(): void {
  if (started) return;
  if (typeof window === "undefined") return;
  started = true;

  // Recover ops left in `in_flight` by a previous tab/crash before the
  // first sync — otherwise listPending skips them and they're stuck.
  void (async () => {
    if (hasSessionKey()) {
      try {
        await revertStaleInFlight();
      } catch {
        // best-effort; the next push will still drain new pending ops
      }
    }
    await maybeSync();
  })();

  window.addEventListener("online", () => {
    // Coming back online is the right boundary to rescue ops parked at
    // status="error" by a transient failure (server restart, brief 502,
    // intermittent network). Bounded by an attempts cap inside so a
    // permanent error doesn't loop forever.
    void requeueErroredOps().then(() => maybeSync());
  });
  window.addEventListener("focus", () => {
    void maybeSync();
  });
  heartbeat = setInterval(() => {
    if (document.visibilityState === "visible") void maybeSync();
  }, HEARTBEAT_MS);

  // Respond to SW background-sync wakeups.
  if ("serviceWorker" in navigator) {
    swMessageHandler = (ev: MessageEvent) => {
      const data = ev.data as { type?: string } | null;
      if (data && data.type === "TRIGGER_PUSH") void triggerPush();
    };
    navigator.serviceWorker.addEventListener("message", swMessageHandler);
  }
}

/**
 * Trigger an immediate push → pull cycle. Exposed for the manual "Sync
 * Now" button. Coalesces with in-flight sync via `pullInFlight` and the
 * push-side guard.
 */
export async function runSyncNow(): Promise<void> {
  await maybeSync();
}

export function stopSyncRunner(): void {
  if (heartbeat !== null) clearInterval(heartbeat);
  heartbeat = null;
  started = false;
  if (swMessageHandler && "serviceWorker" in navigator) {
    navigator.serviceWorker.removeEventListener("message", swMessageHandler);
    swMessageHandler = null;
  }
}

export { pullSync, triggerPush };
