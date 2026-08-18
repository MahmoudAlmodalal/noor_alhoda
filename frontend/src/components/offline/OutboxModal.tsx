"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Clock, RefreshCw, Trash2, CheckCircle2 } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getDb, type OutboxRow } from "@/lib/db/schema";
import { clearErroredOps, dropErroredOp, retryErroredOps } from "@/lib/sync/outbox";
import { runSyncNow } from "@/lib/sync/runner";
import { onChange } from "@/lib/db/events";

interface OutboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RESOURCE_LABELS: Record<string, string> = {
  student: "طالب",
  teacher: "محفظ",
  parent: "ولي أمر",
  parent_student_link: "ربط ولي أمر",
  weekly_plan: "خطة شهرية",
  daily_record: "سجل يومي",
  review_record: "سجل مراجعة",
  evaluation: "اختبار",
  notification: "إشعار",
  course: "دورة",
  student_course: "تسجيل دورة",
  progress: "تقدم الحفظ",
};

const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  direct_message: "رسالة مباشرة",
};

export function OutboxModal({ isOpen, onClose }: OutboxModalProps) {
  const [items, setItems] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchOutboxItems = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getDb().outbox.toArray();
      // Sort: errors first, then in_flight, then pending, newest first
      rows.sort((a, b) => {
        if (a.status === "error" && b.status !== "error") return -1;
        if (a.status !== "error" && b.status === "error") return 1;
        return b.created_at.localeCompare(a.created_at);
      });
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchOutboxItems();
    const unsub = onChange("outbox", () => {
      fetchOutboxItems();
    });
    return unsub;
  }, [isOpen, fetchOutboxItems]);

  const handleRetryAll = async () => {
    setActionInProgress(true);
    try {
      await retryErroredOps();
      await runSyncNow();
    } finally {
      setActionInProgress(false);
    }
  };

  const handleClearAllErrors = async () => {
    setActionInProgress(true);
    try {
      await clearErroredOps();
      await fetchOutboxItems();
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDropItem = async (opId: string) => {
    setActionInProgress(true);
    try {
      await dropErroredOp(opId);
      await fetchOutboxItems();
    } finally {
      setActionInProgress(false);
    }
  };

  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">سجل العمليات المعلقة والمزامنة</h2>
          <p className="text-xs text-gray-500">تفاصيل العمليات المخزنة محلياً بانتظار المزامنة مع السيرفر</p>
        </div>
        {/* Header Summary & Actions */}
        <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
          <div className="text-sm font-medium text-gray-700">
            إجمالي العمليات: <span className="font-bold text-gray-900">{items.length}</span>
            {errorCount > 0 && (
              <span className="mr-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 font-semibold">
                {errorCount} أخطاء
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAllErrors}
                disabled={actionInProgress}
                className="flex items-center gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                تنظيف الأخطاء
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetryAll}
              disabled={actionInProgress || items.length === 0}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${actionInProgress ? "animate-spin" : ""}`} />
              إعادة محاولة الكل
            </Button>
          </div>
        </div>

        {/* List of items */}
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">جاري تحميل العمليات...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            جميع العمليات متزامنة بنجاح! لا يوجد عمليات معلقة.
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {items.map((row) => {
              const isError = row.status === "error";
              const isInFlight = row.status === "in_flight";
              const resLabel = RESOURCE_LABELS[row.resource] || row.resource;
              const actLabel = ACTION_LABELS[row.action] || row.action;

              return (
                <div
                  key={row.op_id}
                  className={`rounded-xl border p-3 text-xs transition-colors ${
                    isError
                      ? "border-red-200 bg-red-50/50"
                      : isInFlight
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">
                          {actLabel} {resLabel}
                        </span>

                        {isError && (
                          <span className="flex items-center gap-1 text-red-600 font-semibold">
                            <AlertCircle className="h-3.5 w-3.5" />
                            فشل ({row.attempts} محاولات)
                          </span>
                        )}

                        {isInFlight && (
                          <span className="flex items-center gap-1 text-blue-600 font-semibold">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            جاري المزامنة...
                          </span>
                        )}

                        {!isError && !isInFlight && (
                          <span className="flex items-center gap-1 text-amber-600 font-semibold">
                            <Clock className="h-3.5 w-3.5" />
                            معلقة
                          </span>
                        )}
                      </div>

                      <div className="text-gray-500">
                        معرّف السجل: <code className="text-[11px]">{row.target_id.slice(0, 8)}...</code>
                      </div>

                      {/* Error details if present */}
                      {isError && row.last_error && (
                        <div className="mt-1 rounded bg-red-100/80 p-1.5 text-red-800 font-medium">
                          سبب الفشل: {row.last_error}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDropItem(row.op_id)}
                      disabled={actionInProgress}
                      title="حذف هذه العملية المعلقة"
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
}
