"use client";

import { useMemo, useState } from "react";
import { Calendar, Edit, Inbox, PlusCircle, Trash2 } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
import { WeeklyPlanModal } from "@/components/plans/WeeklyPlanModal";
import { ConfirmDeleteModal } from "@/components/modals/TeacherModals";
import { useQuery } from "@/hooks/useApi";
import type { PlanForList } from "@/lib/db/repos/aggregates";
import { cn } from "@/lib/utils";

type MonthFilter = "current" | "last" | "all";

function monthStartFor(offset: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  teacherId: string;
}

export function TeacherPlansTab({ teacherId }: Props) {
  const [monthFilter, setMonthFilter] = useState<MonthFilter>("current");
  const [modalOpen, setModalOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<{
    id: string;
    studentId: string;
    studentName: string;
    requiredPages?: number;
    monthStart: string;
  } | null>(null);
  const [deletePlan, setDeletePlan] = useState<{ id: string; name: string } | null>(null);

  const monthStart = useMemo(() => {
    if (monthFilter === "current") return monthStartFor(0);
    if (monthFilter === "last") return monthStartFor(-1);
    return undefined;
  }, [monthFilter]);

  const { data: plans, isLoading } = useQuery<PlanForList[]>("plans_for_ui", {
    teacher_id: teacherId,
    ...(monthStart ? { month_start: monthStart } : {}),
  });

  const rows = useMemo(
    () =>
      (plans ?? []).slice().sort((a, b) => {
        if (a.month_start !== b.month_start)
          return (b.month_start ?? b.week_start).localeCompare(a.month_start ?? a.week_start);
        return a.student_name.localeCompare(b.student_name, "ar");
      }),
    [plans]
  );

  const totals = useMemo(() => {
    const required = rows.reduce((s, r) => s + (r.total_required || 0), 0);
    const achieved = rows.reduce((s, r) => s + (r.total_achieved || 0), 0);
    const rate = required > 0 ? Math.round((achieved / required) * 100) : 0;
    return { required, achieved, rate, count: rows.length };
  }, [rows]);

  return (
    <section className="overflow-hidden rounded-[24px] border border-border-card bg-white shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex flex-col gap-3 border-b border-border-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-text-body">
            الخطط الشهرية
            <span className="ms-2 text-xs font-medium text-text-muted">
              ({totals.count})
            </span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<MonthFilter>
            size="sm"
            options={[
              { value: "current", label: "هذا الشهر" },
              { value: "last", label: "الشهر الماضي" },
              { value: "all", label: "الكل" },
            ]}
            value={monthFilter}
            onChange={setMonthFilter}
          />
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-3 text-[12px] font-bold text-white transition-colors hover:bg-primary/90"
          >
            <PlusCircle className="h-4 w-4" />
            إنشاء خطة
          </button>
        </div>
      </div>

      {totals.count > 0 ? (
        <div className="flex flex-wrap items-center gap-4 border-b border-border-card bg-surface-subtle/50 px-4 py-3 text-[12px] font-bold text-text-body">
          <span>
            المطلوب: <span className="text-primary">{totals.required}</span>
          </span>
          <span>
            المنجز: <span className="text-primary">{totals.achieved}</span>
          </span>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px]",
              totals.rate >= 80
                ? "bg-green-50 text-green-600"
                : totals.rate >= 50
                  ? "bg-orange-50 text-orange-600"
                  : "bg-red-50 text-red-600"
            )}
          >
            الإنجاز: {totals.rate}%
          </span>
        </div>
      ) : null}

      {isLoading && !plans ? (
        <div className="px-5 py-12 text-center text-sm text-text-muted">
          جارٍ التحميل...
        </div>
      ) : rows.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={<Inbox size={28} />}
            tone="soft"
            title="لا توجد خطط للفترة المحددة"
            description={
                monthFilter === "current"
                ? "أنشئ خطة شهرية جديدة لطلاب حلقتك."
                : "غيّر عامل تصفية الشهر لعرض خطط أخرى."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface-subtle/80 text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-bold">الطالب</th>
                <th className="px-4 py-3 font-bold">شهر الخطة</th>
                <th className="px-4 py-3 font-bold">المطلوب</th>
                <th className="px-4 py-3 font-bold">المنجز</th>
                <th className="px-4 py-3 font-bold">الأسطر</th>
                <th className="px-4 py-3 font-bold">الصفحات</th>
                <th className="px-4 py-3 font-bold">النسبة</th>
                <th className="px-4 py-3 font-bold text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const rate = p.completion_rate;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border-card last:border-b-0"
                  >
                    <td className="px-4 py-3 font-semibold text-text-body">
                      {p.student_name}
                    </td>
                    <td className="px-4 py-3 text-text-label" dir="ltr">
                      {(p.month_start ?? p.week_start).slice(0, 7)}
                    </td>
                    <td className="px-4 py-3 text-text-label">
                      {p.total_required}
                    </td>
                    <td className="px-4 py-3 text-text-label">
                      {p.total_achieved}
                    </td>
                    <td className="px-4 py-3 text-text-label">
                      {p.total_lines ?? 0}
                    </td>
                    <td className="px-4 py-3 font-bold text-purple-600">
                      {p.total_lines ? (p.total_lines / 15).toFixed(1) : "0"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border-card">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              rate >= 80
                                ? "bg-emerald-500"
                                : rate >= 50
                                  ? "bg-orange-500"
                                  : "bg-red-500"
                            )}
                            style={{ width: `${Math.min(100, rate)}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "text-[11px] font-bold",
                            rate >= 80
                              ? "text-emerald-600"
                              : rate >= 50
                                ? "text-orange-600"
                                : "text-red-600"
                          )}
                        >
                          {rate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditPlan({
                              id: p.id,
                              studentId: p.student_id,
                              studentName: p.student_name,
                              requiredPages: p.required_pages,
                              monthStart: p.month_start ?? p.week_start,
                            });
                          }}
                          className="p-1 text-text-muted hover:text-primary transition-colors"
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletePlan({
                              id: p.id,
                              name: p.student_name,
                            });
                          }}
                          className="p-1 text-text-muted hover:text-red-500 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <WeeklyPlanModal
        isOpen={modalOpen || !!editPlan}
        onClose={() => {
          setModalOpen(false);
          setEditPlan(null);
        }}
        studentId={editPlan?.studentId}
        studentName={editPlan?.studentName}
        editPlanId={editPlan?.id}
        initialRequiredPages={editPlan?.requiredPages}
        initialMonthStart={editPlan?.monthStart}
      />

      {deletePlan && (
        <ConfirmDeleteModal
          isOpen={!!deletePlan}
          onClose={() => setDeletePlan(null)}
          targetName={`${deletePlan.name} (خطة شهرية ${(rows.find((r) => r.id === deletePlan.id)?.month_start ?? rows.find((r) => r.id === deletePlan.id)?.week_start ?? "").slice(0, 7)})`}
          resource="weekly_plan"
          targetId={deletePlan.id}
          onSuccess={() => setDeletePlan(null)}
        />
      )}
    </section>
  );
}
