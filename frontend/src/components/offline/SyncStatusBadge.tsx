"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, CloudOff, AlertCircle } from "lucide-react";

import { useSyncStatus } from "@/hooks/useSyncStatus";
import { runSyncNow } from "@/lib/sync/runner";
import { cn } from "@/lib/utils";

import { OutboxModal } from "@/components/offline/OutboxModal";

/**
 * Sidebar footer badge showing sync health + a "Sync Now" button and Outbox details.
 */
export function SyncStatusBadge() {
  const { pending, errors, lastError } = useSyncStatus();
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const onClickSync = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (syncing) return;
      setSyncing(true);
      try {
        await runSyncNow();
      } finally {
        setSyncing(false);
      }
    },
    [syncing]
  );

  const hasErrors = errors > 0;
  const hasPending = pending > 0;

  let label = "متزامن";
  let Icon = CheckCircle2;
  let color = "text-emerald-600";
  let bg = "bg-emerald-50";

  if (!online) {
    label = "دون اتصال";
    Icon = CloudOff;
    color = "text-gray-500";
    bg = "bg-gray-100";
  } else if (syncing) {
    label = "جاري المزامنة…";
    Icon = RefreshCw;
    color = "text-primary";
    bg = "bg-primary/10";
  } else if (hasErrors) {
    label = `${errors} خطأ (اضغط للتفاصيل)`;
    Icon = AlertCircle;
    color = "text-red-600";
    bg = "bg-red-50";
  } else if (hasPending) {
    label = `${pending} معلّقة`;
    Icon = RefreshCw;
    color = "text-amber-600";
    bg = "bg-amber-50";
  }

  return (
    <>
      <div
        className={cn(
          "flex w-full items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors",
          bg,
          color
        )}
      >
        <button
          type="button"
          onClick={onClickSync}
          disabled={syncing || !online}
          title={hasErrors && lastError ? `فشل المزامنة: ${lastError}` : "اضغط للمزامنة الآن"}
          className="flex flex-1 items-center gap-2 text-right hover:brightness-95 disabled:opacity-60"
        >
          <Icon className={cn("h-4 w-4 shrink-0", syncing && "animate-spin")} />
          <span className="flex-1 text-right">{label}</span>
        </button>

        {(hasPending || hasErrors) && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            title="عرض تفاصيل العمليات المعلقة والأخطاء"
            className="rounded-lg p-1 text-[10px] underline hover:bg-black/5"
          >
            التفاصيل
          </button>
        )}
      </div>

      <OutboxModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
