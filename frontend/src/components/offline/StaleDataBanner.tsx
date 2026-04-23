"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { readAuth } from "@/lib/db/auth";
import { onChange } from "@/lib/db/events";

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DISMISS_KEY = "stale_banner_dismissed_at";
const DISMISS_WINDOW_MS = 24 * 60 * 60 * 1000; // re-nag after 24h

/**
 * Non-blocking banner shown when the local DB hasn't been synced in 7+
 * days. Dismissible for 24h via sessionStorage. Refreshes whenever the
 * outbox/auth change-events fire so the banner drops off automatically
 * after a successful sync.
 */
export function StaleDataBanner() {
  const [stale, setStale] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    const at = Number(sessionStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < DISMISS_WINDOW_MS;
  });

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const row = await readAuth();
      if (!alive) return;
      if (!row?.last_sync_at) {
        // No sync yet — DownloadScreen handles that case.
        setStale(false);
        return;
      }
      const age = Date.now() - new Date(row.last_sync_at).getTime();
      setStale(age >= STALE_THRESHOLD_MS);
    };
    void check();

    // Re-check on outbox activity (push round-trip) and hourly.
    const unsub = onChange("outbox", () => void check());
    const interval = setInterval(() => void check(), 60 * 60 * 1000);
    return () => {
      alive = false;
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (!stale || dismissed) return null;

  const onDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <Clock className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1 text-right leading-relaxed">
        لم تتم مزامنة البيانات منذ أكثر من 7 أيام — حاول الاتصال بالإنترنت لتحديث بياناتك.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md px-2 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100"
      >
        إغلاق
      </button>
    </div>
  );
}
