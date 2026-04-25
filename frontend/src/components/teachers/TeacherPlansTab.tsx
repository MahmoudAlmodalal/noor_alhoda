"use client";

import { useMemo, useState } from "react";
import { Calendar, Inbox, PlusCircle } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
import { WeeklyPlanModal } from "@/components/plans/WeeklyPlanModal";
import { useQuery } from "@/hooks/useApi";
import type { PlanForList } from "@/lib/db/repos/aggregates";
import { cn } from "@/lib/utils";

type WeekFilter = "current" | "last" | "all";

function weekStartFor(d: Date): string {
  const copy = new Date(d.getTime());
  const diff = (copy.getDay() - 6 + 7) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy.toISOString().slice(0, 10);
}

function lastWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return weekStartFor(d);
}

interface Props {
  teacherId: string;
}

export function TeacherPlansTab({ teacherId }: Props) {
  const [weekFilter, setWeekFilter] = useState<WeekFilter>("current");
  const [modalOpen, setModalOpen] = useState(false);

  const weekStart = useMemo(() => {
    if (weekFilter === "current") return weekStartFor(new Date());
    if (weekFilter === "last") return lastWeekStart();
    return undefined;
  }, [weekFilter]);

  const { data: plans, isLoading } = useQuery<PlanForList[]>("plans_for_ui", {
    teacher_id: teacherId,
    ...(weekStart ? { week_start: weekStart } : {}),
  });

  const rows = useMemo(
    () =>
      (plans ?? []).slice().sort((a, b) => {
        if (a.week_start !== b.week_start)
          return b.week_start.localeCompare(a.week_start);
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
            الخطط الأسبوعية
            <span className="ms-2 text-xs font-medium text-text-muted">
              ({totals.count})
            </span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<WeekFilter>
            size="sm"
            options={[
              { value: "current", label: "هذا الأسبوع" },
              { value: "last", label: "الأسبوع الماضي" },
              { value: "all", label: "الكل" },
            ]}
            value={weekFilter}
            onChange={setWeekFilter}
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
              weekFilter === "current"
                ? "أنشئ خطة جديدة لطلاب حلقتك لهذا الأسبوع."
                : "غيّر عامل تصفية الأسبوع لعرض خطط أخرى."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface-subtle/80 text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-bold">الطالب</th>
                <th className="px-4 py-3 font-bold">بداية الأسبوع</th>
                <th className="px-4 py-3 font-bold">المطلوب</th>
                <th className="px-4 py-3 font-bold">المنجز</th>
                <th className="px-4 py-3 font-bold">النسبة</th>
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
                      {p.week_start}
                    </td>
                    <td className="px-4 py-3 text-text-label">
                      {p.total_required}
                    </td>
                    <td className="px-4 py-3 text-text-label">
                      {p.total_achieved}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <WeeklyPlanModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </section>
  );
}
