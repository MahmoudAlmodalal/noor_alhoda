"use client";

/**
 * Re-runs a fetch for surfaces that live outside the offline sync pipeline.
 *
 * `useQuery` refetches on change events, which the sync runner emits after
 * every pull. Resources that are deliberately network-only — conversations,
 * the change-request queue — have no such event, so a plain fetch-on-mount
 * leaves them frozen until the user reloads the page: a teacher's message
 * never appears for the student, and vice versa.
 *
 * Mirrors the sync runner's trigger set (`src/lib/sync/runner.ts`): window
 * focus, `online`, and a heartbeat that only ticks while the tab is visible.
 */
import { useEffect, useRef } from "react";

export const REVALIDATE_INTERVAL_MS = 30_000;

export function useRevalidate(
  run: () => void | Promise<void>,
  intervalMs: number = REVALIDATE_INTERVAL_MS
): void {
  // Keep the latest callback without re-arming the listeners on every render,
  // so callers don't have to memoize it.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    const fire = () => {
      void runRef.current();
    };

    const onFocus = () => fire();
    const onOnline = () => fire();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible") fire();
    }, intervalMs);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      clearInterval(heartbeat);
    };
  }, [intervalMs]);
}
