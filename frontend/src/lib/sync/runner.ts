/**
 * Sync runner: boots the pull loop in the browser. Pulls on start, on
 * `online` events, and on a 30s heartbeat while the page is visible.
 * Only runs after the user has unlocked their DB session.
 */
import { hasSessionKey } from "../db/auth";

import { pullSync } from "./pull";

const HEARTBEAT_MS = 30_000;

let started = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;

async function maybePull(): Promise<void> {
  if (!hasSessionKey()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  await pullSync();
}

export function startSyncRunner(): void {
  if (started) return;
  if (typeof window === "undefined") return;
  started = true;

  void maybePull();

  window.addEventListener("online", () => {
    void maybePull();
  });
  window.addEventListener("focus", () => {
    void maybePull();
  });
  heartbeat = setInterval(() => {
    if (document.visibilityState === "visible") void maybePull();
  }, HEARTBEAT_MS);
}

export function stopSyncRunner(): void {
  if (heartbeat !== null) clearInterval(heartbeat);
  heartbeat = null;
  started = false;
}

export { pullSync };
