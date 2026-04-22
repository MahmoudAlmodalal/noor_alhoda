"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

/**
 * Thin banner shown at the top of the dashboard when the browser reports
 * offline OR the current session is an offline-auth session. Arabic copy,
 * RTL-safe.
 */
export function OfflineBanner() {
  const { isOfflineSession } = useAuth();
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online && !isOfflineSession) return null;

  const message = !online
    ? "أنت تعمل دون اتصال بالإنترنت. سيتم حفظ أي تعديلات محلياً ومزامنتها عند عودة الاتصال."
    : "هذه جلسة دون اتصال — تم التحقق من كلمة المرور محلياً فقط.";

  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-b-2xl border-b border-amber-200 bg-tile-yellow px-4 py-2 text-sm text-amber-900"
    >
      {!online ? (
        <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span className="flex-1 text-right leading-relaxed">{message}</span>
    </div>
  );
}
