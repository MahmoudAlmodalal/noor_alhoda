"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Inbox, PlusCircle } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { EvaluationStatusBadge } from "@/components/ui/EvaluationStatusBadge";
import { EvaluationCreateModal } from "@/components/modals/EvaluationCreateModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useQuery } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useMutation";
import type { EvaluationForTeacher } from "@/lib/db/repos/aggregates";

type StatusFilter = "all" | "scheduled" | "passed" | "failed" | "missed";
type ResultStatus = "passed" | "failed" | "missed";

interface PendingAction {
  id: string;
  status: ResultStatus;
  studentName: string;
}

const ACTION_TITLES: Record<ResultStatus, string> = {
  passed: "تأكيد نجاح الطالب",
  failed: "تأكيد رسوب الطالب",
  missed: "تأكيد غياب الطالب",
};

const ACTION_MESSAGES: Record<ResultStatus, (name: string) => string> = {
  passed: (name) => `هل تريد تسجيل نتيجة ${name} كناجح في هذا الاختبار؟`,
  failed: (name) =>
    `سيؤدي ذلك إلى تصفير حالة إتقان السور ذات الصلة لدى ${name}. هل أنت متأكد من تسجيل النتيجة كراسب؟`,
  missed: (name) => `هل تريد تسجيل غياب ${name} عن هذا الاختبار؟`,
};

interface Props {
  teacherId: string;
}

export function TeacherEvaluationsTab({ teacherId }: Props) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const updateEval = useMutation("evaluation", "update");

  const { data: evals, isLoading } = useQuery<EvaluationForTeacher[]>(
    "evaluations_for_teacher",
    { teacher_id: teacherId }
  );

  const filtered = useMemo(() => {
    const rows = evals ?? [];
    if (filter === "all") return rows;
    return rows.filter((e) => e.status === filter);
  }, [evals, filter]);

  const counts = useMemo(() => {
    const rows = evals ?? [];
    return {
      all: rows.length,
      scheduled: rows.filter((e) => e.status === "scheduled").length,
      passed: rows.filter((e) => e.status === "passed").length,
      failed: rows.filter((e) => e.status === "failed").length,
      missed: rows.filter((e) => e.status === "missed").length,
    };
  }, [evals]);

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    await updateEval.mutate(
      { id: pendingAction.id, status: pendingAction.status },
      { successMessage: "تم تحديث الاختبار" }
    );
    setPendingAction(null);
  };

  return (
    <section className="overflow-hidden rounded-[24px] border border-border-card bg-white shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex flex-col gap-3 border-b border-border-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-text-body">
            الاختبارات
            <span className="ms-2 text-xs font-medium text-text-muted">
              ({counts.all})
            </span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<StatusFilter>
            size="sm"
            options={[
              { value: "all", label: `الكل (${counts.all})` },
              { value: "scheduled", label: `مجدول (${counts.scheduled})` },
              { value: "passed", label: `ناجح (${counts.passed})` },
              { value: "failed", label: `راسب (${counts.failed})` },
              { value: "missed", label: `متغيّب (${counts.missed})` },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-3 text-[12px] font-bold text-white transition-colors hover:bg-primary/90"
          >
            <PlusCircle className="h-4 w-4" />
            جدولة اختبار
          </button>
        </div>
      </div>

      {isLoading && !evals ? (
        <div className="px-5 py-12 text-center text-sm text-text-muted">
          جارٍ التحميل...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={<Inbox size={28} />}
            tone="soft"
            title={
              counts.all === 0
                ? "لا توجد اختبارات مجدولة بعد"
                : "لا توجد اختبارات مطابقة"
            }
            description={
              counts.all === 0
                ? "ابدأ بجدولة اختبار جديد لطلاب حلقتك."
                : "جرّب تغيير عامل التصفية لرؤية اختبارات أخرى."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface-subtle/80 text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-bold">الطالب</th>
                <th className="px-4 py-3 font-bold">العنوان</th>
                <th className="px-4 py-3 font-bold">النطاق</th>
                <th className="px-4 py-3 font-bold">التاريخ</th>
                <th className="px-4 py-3 font-bold">الحالة</th>
                <th className="px-4 py-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border-card last:border-b-0"
                >
                  <td className="px-4 py-3 font-semibold text-text-body">
                    {e.student_name}
                  </td>
                  <td className="px-4 py-3 text-text-label">{e.title}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {e.surah_range || "—"}
                  </td>
                  <td className="px-4 py-3 text-text-label" dir="ltr">
                    {e.scheduled_date}
                  </td>
                  <td className="px-4 py-3">
                    <EvaluationStatusBadge value={e.status} />
                  </td>
                  <td className="px-4 py-3">
                    {e.status === "scheduled" ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({
                              id: e.id,
                              status: "passed",
                              studentName: e.student_name,
                            })
                          }
                          disabled={updateEval.isSubmitting}
                          className="inline-flex h-7 items-center rounded-md bg-emerald-50 px-2 text-[11px] font-bold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                        >
                          تم
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({
                              id: e.id,
                              status: "failed",
                              studentName: e.student_name,
                            })
                          }
                          disabled={updateEval.isSubmitting}
                          className="inline-flex h-7 items-center rounded-md bg-red-50 px-2 text-[11px] font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                        >
                          لم ينجح
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({
                              id: e.id,
                              status: "missed",
                              studentName: e.student_name,
                            })
                          }
                          disabled={updateEval.isSubmitting}
                          className="inline-flex h-7 items-center rounded-md bg-amber-50 px-2 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                        >
                          غياب
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EvaluationCreateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        teacherId={teacherId}
      />

      <ConfirmDialog
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        title={pendingAction ? ACTION_TITLES[pendingAction.status] : ""}
        message={
          pendingAction
            ? ACTION_MESSAGES[pendingAction.status](pendingAction.studentName)
            : ""
        }
        destructive={pendingAction?.status === "failed"}
        isSubmitting={updateEval.isSubmitting}
      />
    </section>
  );
}
