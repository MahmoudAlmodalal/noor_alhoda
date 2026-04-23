"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudDownload, CheckCircle2, AlertTriangle, WifiOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { downloadFullDb, type DownloadProgress } from "@/lib/sync/download";

/**
 * Full-screen overlay shown the first time a user logs in on a device
 * (i.e. `auth.last_sync_at === null`). Blocks the dashboard until the
 * encrypted local DB has been seeded from the server. Runs the same
 * `applyPullResponse` path as the delta pull, but with byte-level
 * progress reporting.
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

export function DownloadScreen() {
  const { markInitialDownloadComplete, isOfflineSession } = useAuth();
  const [progress, setProgress] = useState<DownloadProgress>({ phase: "downloading", percent: 0 });
  const [error, setError] = useState<string | null>(null);
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

  const run = useCallback(async () => {
    setError(null);
    setProgress({ phase: "downloading", percent: 0 });
    const result = await downloadFullDb((p) => setProgress(p));
    if (result.ok) {
      // Give the success state a beat on screen, then release the gate.
      await new Promise((r) => setTimeout(r, 400));
      markInitialDownloadComplete();
    } else {
      setError(result.error ?? "فشل التنزيل.");
    }
  }, [markInitialDownloadComplete]);

  useEffect(() => {
    // Don't auto-start when the user is in an offline-only session —
    // there's nothing to download until they reconnect.
    if (isOfflineSession || !online) return;
    const id = setTimeout(() => void run(), 0);
    return () => clearTimeout(id);
  }, [run, isOfflineSession, online]);

  // Retry automatically once the network returns if we were waiting.
  useEffect(() => {
    if (online && !isOfflineSession && error) {
      const id = setTimeout(() => void run(), 0);
      return () => clearTimeout(id);
    }
  }, [online, isOfflineSession, error, run]);

  const percent = Math.max(0, Math.min(1, progress.percent < 0 ? 0 : progress.percent));
  const percentLabel = progress.percent < 0 ? "" : `${Math.round(percent * 100)}%`;
  const indeterminate = progress.percent < 0;

  let statusText = "";
  if (error) {
    statusText = error;
  } else if (!online || isOfflineSession) {
    statusText = "لا يمكن تنزيل البيانات دون اتصال بالإنترنت. سيُستأنف التنزيل تلقائياً عند الاتصال.";
  } else if (progress.phase === "downloading") {
    statusText = indeterminate ? "جاري تنزيل بياناتك…" : `جاري تنزيل بياناتك… ${percentLabel}`;
  } else if (progress.phase === "saving") {
    const label = progress.table ? TABLE_LABELS[progress.table] ?? progress.table : "";
    statusText = `جاري حفظ البيانات… ${label} (${progress.tableIndex}/${progress.tableTotal})`;
  } else if (progress.phase === "done") {
    statusText = "اكتمل التحميل ✓";
  }

  const Icon = error
    ? AlertTriangle
    : !online || isOfflineSession
      ? WifiOff
      : progress.phase === "done"
        ? CheckCircle2
        : CloudDownload;

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="جاري تجهيز التطبيق"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm"
      style={{ background: "linear-gradient(104deg, #eff6ff 0%, #fff7ed 100%)" }}
    >
      <div className="mx-4 w-full max-w-md rounded-3xl border border-border-card bg-white p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col items-center text-center">
          <div
            className={
              error
                ? "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600"
                : progress.phase === "done"
                  ? "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"
                  : !online || isOfflineSession
                    ? "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"
                    : "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            }
          >
            <Icon className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-text-title">تجهيز التطبيق للعمل دون اتصال</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-body">
            نقوم بتنزيل بياناتك وحفظها بشكل مشفّر على هذا الجهاز. لن يتكرر ذلك لاحقاً.
          </p>

          <div className="mt-6 w-full">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
              <div
                className={
                  indeterminate
                    ? "h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] bg-primary"
                    : error
                      ? "h-full bg-red-500 transition-all"
                      : progress.phase === "done"
                        ? "h-full bg-emerald-500 transition-all"
                        : "h-full bg-primary transition-all"
                }
                style={indeterminate ? undefined : { width: `${Math.round(percent * 100)}%` }}
              />
            </div>
            <p className="mt-3 min-h-[1.5rem] text-xs text-text-label">{statusText}</p>
          </div>

          {error && online && !isOfflineSession && (
            <button
              type="button"
              onClick={() => void run()}
              className="mt-5 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary/90"
            >
              إعادة المحاولة
            </button>
          )}
        </div>
      </div>

      {/* Indeterminate shimmer keyframes — scoped via global CSS would be
          ideal, but an inline style tag keeps this self-contained. */}
      <style>{`@keyframes slide { 0% { transform: translateX(100%); } 100% { transform: translateX(-300%); } }`}</style>
    </div>
  );
}
