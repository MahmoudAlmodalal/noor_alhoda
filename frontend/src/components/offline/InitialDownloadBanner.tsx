"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudDownload, Loader2, WifiOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

/**
 * Non-blocking banner shown while the first-device full download runs in
 * the background. Auto-hides once sync completes. The dashboard renders
 * normally underneath; pages fill in via `emitChanges` → `useQuery` as
 * tables are upserted. Error/retry and offline hints are surfaced inline
 * so the user can act without being locked out.
 */
const TABLE_LABELS: Record<string, string> = {
  users: "المستخدمون",
  teachers: "المحفظون",
  parents: "أولياء الأمور",
  students: "الطلاب",
  parent_student_links: "روابط الأسر",
  weekly_plans: "خطط التسميع",
  daily_records: "السجلات اليومية",
  review_records: "سجلات المراجعة",
  evaluations: "التقييمات",
  notifications: "الإشعارات",
  courses: "الدورات",
  student_courses: "تسجيلات الدورات",
};

type Variant = "downloading" | "saving" | "error" | "offline";

/** Seconds to wait before showing the "wipe & retry" escape button. */
const INSTALL_STUCK_THRESHOLD_S = 15;

export function InitialDownloadBanner() {
  const {
    isDownloading,
    downloadProgress,
    downloadError,
    isOfflineSession,
    isInstallingDb,
    needsInitialDownload,
    retryInitialDownload,
    wipeDeviceData,
  } = useAuth();

  // Track how long the DB-install phase has been running so we can surface
  // an escape hatch if it appears stuck (e.g. IndexedDB version-upgrade
  // deadlock from another tab holding an open connection).
  const [installElapsed, setInstallElapsed] = useState(0);

  useEffect(() => {
    if (!isInstallingDb) {
      setInstallElapsed(0);
      return;
    }
    const id = setInterval(() => setInstallElapsed((s) => s + 1), 1_000);
    return () => clearInterval(id);
  }, [isInstallingDb]);

  // Phase 1: the encrypted-DB key is still being derived/unwrapped in the
  // background after a successful online login. Show a compact strip so the
  // user knows the app is still waking up; the download banner takes over
  // once install finishes and the first-device download starts.
  if (isInstallingDb) {
    const showEscape = installElapsed >= INSTALL_STUCK_THRESHOLD_S;
    return (
      <div role="status" className="border-b border-blue-300 bg-blue-50 text-blue-900">
        <div className="flex items-center gap-2 px-4 py-2 text-sm">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span className="flex-1 text-right leading-relaxed">
            {showEscape
              ? "يبدو أن تجهيز الوضع المحلي متوقف. يمكنك مسح البيانات وإعادة المحاولة."
              : "جاري تجهيز الوضع المحلي…"}
          </span>
          {showEscape && (
            <button
              type="button"
              onClick={() => void wipeDeviceData()}
              className="whitespace-nowrap rounded-md bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700"
            >
              مسح البيانات وإعادة تسجيل الدخول
            </button>
          )}
        </div>
      </div>
    );
  }

  let variant: Variant | null = null;
  if (downloadError) {
    variant = isOfflineSession ? "offline" : "error";
  } else if (isDownloading) {
    variant = downloadProgress?.phase === "saving" ? "saving" : "downloading";
  } else if (needsInitialDownload && isOfflineSession) {
    variant = "offline";
  }

  if (variant === null) return null;

  const rawPercent = downloadProgress?.percent ?? 0;
  const indeterminate = variant !== "error" && variant !== "offline" && rawPercent < 0;
  const percent = Math.max(0, Math.min(1, indeterminate ? 0 : rawPercent));

  let statusText = "";
  if (variant === "offline") {
    statusText =
      "سيُستأنف تنزيل البيانات تلقائياً عند الاتصال بالإنترنت.";
  } else if (variant === "error") {
    statusText = downloadError ?? "فشل تنزيل البيانات.";
  } else if (variant === "saving") {
    const prog = downloadProgress;
    const label = prog?.table ? TABLE_LABELS[prog.table] ?? prog.table : "";
    const total = prog?.tableTotal ?? 12;
    const idx = prog?.tableIndex ?? 0;
    statusText = `جاري حفظ البيانات في الخلفية… ${label} (${idx}/${total})`;
  } else {
    statusText = indeterminate
      ? "جاري تنزيل البيانات في الخلفية…"
      : `جاري تنزيل البيانات في الخلفية… ${Math.round(percent * 100)}%`;
  }

  const Icon =
    variant === "error"
      ? AlertTriangle
      : variant === "offline"
        ? WifiOff
        : variant === "saving" && downloadProgress?.phase === "done"
          ? CheckCircle2
          : CloudDownload;

  const containerCls =
    variant === "error"
      ? "border-red-300 bg-red-50 text-red-900"
      : variant === "offline"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-blue-300 bg-blue-50 text-blue-900";

  const barCls = variant === "error" ? "bg-red-500" : "bg-primary";

  return (
    <div role="status" className={`border-b ${containerCls}`}>
      <div className="flex items-center gap-2 px-4 py-2 text-sm">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1 text-right leading-relaxed">{statusText}</span>
        {variant === "error" && (
          <button
            type="button"
            onClick={retryInitialDownload}
            className="rounded-md bg-white/70 px-2 py-1 text-xs font-bold hover:bg-white"
          >
            إعادة المحاولة
          </button>
        )}
      </div>
      {variant !== "error" && variant !== "offline" && (
        <div className="h-1 w-full overflow-hidden bg-white/50">
          <div
            className={
              indeterminate
                ? `h-full w-1/3 animate-[initialdl-slide_1.2s_ease-in-out_infinite] ${barCls}`
                : `h-full ${barCls} transition-all`
            }
            style={indeterminate ? undefined : { width: `${Math.round(percent * 100)}%` }}
          />
        </div>
      )}
      <style>{`@keyframes initialdl-slide { 0% { transform: translateX(100%); } 100% { transform: translateX(-300%); } }`}</style>
    </div>
  );
}
