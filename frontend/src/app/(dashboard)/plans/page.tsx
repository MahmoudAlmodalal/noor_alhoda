"use client";

import { useMemo, useState } from "react";
import { BookOpen, Edit, GraduationCap, PlusCircle, Trash2 } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useQuery } from "@/hooks/useApi";
import { WeeklyPlanModal } from "@/components/plans/WeeklyPlanModal";
import { EvaluationCreateModal } from "@/components/modals/EvaluationCreateModal";
import { ConfirmDeleteModal } from "@/components/modals/TeacherModals";
import { ReviewIntervalInput } from "@/components/plans/ReviewIntervalInput";
import type { PlanForList } from "@/lib/db/repos/aggregates";

export default function PlansPage() {
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [weekFilter, setWeekFilter] = useState<string>("");
  const [evalTarget, setEvalTarget] = useState<{ id: string; name: string } | null>(null);
  const [editPlan, setEditPlan] = useState<{
    id: string;
    studentId: string;
    studentName: string;
    totalRequired: number;
    totalRequiredLines?: number;
    weekStart: string;
  } | null>(null);
  const [deletePlan, setDeletePlan] = useState<{ id: string; name: string } | null>(null);

  const params = useMemo<Record<string, string | undefined>>(
    () => ({ week_start: weekFilter || undefined }),
    [weekFilter]
  );

  const { data: plans, isLoading } = useQuery<PlanForList[]>("plans_for_ui", params);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-border-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-tile-blue rounded-full flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">خطط التسميع</h1>
            <p className="text-xs text-text-muted">إدارة الخطط الأسبوعية لطلاب الحلقة</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-text-body">فلترة بالأسبوع</label>
            <input
              type="date"
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
              className="h-11 rounded-xl border border-border-subtle bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              dir="ltr"
            />
          </div>
          {weekFilter && (
            <button
              type="button"
              onClick={() => setWeekFilter("")}
              className="mt-6 text-xs text-primary font-bold hover:underline"
            >
              عرض الكل
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPlanModalOpen(true)}
            className="mt-6 h-11 px-5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            خطة جديدة
          </button>
        </div>
      </div>

      {plans && plans.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="عدد الخطط" value={plans.length} />
          <SummaryCard
            label="إجمالي المطلوب"
            value={plans.reduce((s, p) => s + p.total_required, 0)}
          />
          <SummaryCard
            label="إجمالي المنجز"
            value={plans.reduce((s, p) => s + p.total_achieved, 0)}
          />
          <SummaryCard
            label="متوسط الإنجاز"
            value={`${Math.round(
              plans.reduce((s, p) => s + p.completion_rate, 0) / plans.length
            )}%`}
          />
        </div>
      )}

      {isLoading && !plans ? (
        <PageLoading />
      ) : (plans ?? []).length === 0 ? (
        <div className="bg-white rounded-[24px] p-12 text-center border border-border-card">
          <BookOpen className="w-12 h-12 text-border-subtle mx-auto mb-3" />
          <p className="text-sm text-text-muted font-medium">لا توجد خطط أسبوعية</p>
          <p className="text-xs text-text-muted mt-1">أنشئ خطة جديدة لطلابك</p>
        </div>
      ) : (
        <div className="bg-white rounded-[24px] shadow-sm border border-border-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-right">
              <thead className="text-[10px] text-text-muted bg-surface-subtle/80">
                <tr>
                  <th className="px-4 py-3 font-bold">الطالب</th>
                  <th className="px-4 py-3 font-bold text-center">الأسبوع</th>
                  <th className="px-4 py-3 font-bold text-center">بداية الأسبوع</th>
                  <th className="px-4 py-3 font-bold text-center">المطلوب (آيات / أسطر / صفحات)</th>
                  <th className="px-4 py-3 font-bold text-center">المنجز (آيات / أسطر / صفحات)</th>
                  <th className="px-4 py-3 font-bold text-center">النسبة</th>
                  <th className="px-4 py-3 font-bold text-center">فترة المراجعة</th>
                  <th className="px-4 py-3 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(plans ?? []).map((plan) => {
                  const rate = plan.completion_rate;
                  const reqPages = plan.total_required_pages ?? (plan.total_required_lines ? (plan.total_required_lines / 15).toFixed(1) : 0);
                  const achPages = plan.total_pages ?? (plan.total_lines ? (plan.total_lines / 15).toFixed(1) : 0);
                  return (
                    <tr key={plan.id} className="border-b border-border-card hover:bg-surface-subtle/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-tile-blue rounded-full flex items-center justify-center text-xs font-bold text-primary">
                            {plan.student_name?.[0] ?? "?"}
                          </div>
                          <span className="font-bold text-text-body">{plan.student_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-text-label font-bold">
                        #{plan.week_number}
                      </td>
                      <td className="px-4 py-3 text-center text-text-muted" dir="ltr">
                        {plan.week_start}
                      </td>
                      <td className="px-4 py-3 text-center text-text-label text-xs">
                        <div className="font-bold">{plan.total_required} آية</div>
                        {plan.total_required_lines > 0 && (
                          <div className="text-[10px] text-text-muted mt-0.5 font-medium">
                            {plan.total_required_lines} سطر · ({reqPages} ص)
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-text-label text-xs">
                        <div className="font-bold text-primary">{plan.total_achieved} آية</div>
                        {plan.total_lines > 0 && (
                          <div className="text-[10px] text-text-muted mt-0.5 font-medium">
                            {plan.total_lines} سطر · ({achPages} ص)
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                            rate >= 80
                              ? "bg-green-50 text-green-600"
                              : rate >= 50
                              ? "bg-orange-50 text-orange-600"
                              : "bg-tile-red text-danger-text"
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ReviewIntervalInput
                          studentId={plan.student_id}
                          initialDays={plan.review_interval_days}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEvalTarget({ id: plan.student_id, name: plan.student_name })
                            }
                            className="inline-flex items-center gap-1 rounded-[10px] border border-primary/30 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/5"
                            title="اختبار"
                          >
                            <GraduationCap className="h-3.5 w-3.5" />
                            اختبار
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditPlan({
                                id: plan.id,
                                studentId: plan.student_id,
                                studentName: plan.student_name,
                                totalRequired: plan.total_required,
                                totalRequiredLines: plan.total_required_lines,
                                weekStart: plan.week_start,
                              })
                            }
                            className="p-1 text-text-muted hover:text-primary transition-colors"
                            title="تعديل الخطة"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeletePlan({
                                id: plan.id,
                                name: plan.student_name,
                              })
                            }
                            className="p-1 text-text-muted hover:text-red-500 transition-colors"
                            title="حذف الخطة"
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
        </div>
      )}

      <WeeklyPlanModal
        isOpen={planModalOpen || !!editPlan}
        onClose={() => {
          setPlanModalOpen(false);
          setEditPlan(null);
        }}
        studentId={editPlan?.studentId}
        studentName={editPlan?.studentName}
        editPlanId={editPlan?.id}
        initialTotalRequired={editPlan?.totalRequired}
        initialTotalRequiredLines={editPlan?.totalRequiredLines}
        initialWeekStart={editPlan?.weekStart}
      />

      {deletePlan && (
        <ConfirmDeleteModal
          isOpen={!!deletePlan}
          onClose={() => setDeletePlan(null)}
          targetName={`${deletePlan.name} (خطة أسبوع ${plans?.find((r) => r.id === deletePlan.id)?.week_start || ""})`}
          resource="weekly_plan"
          targetId={deletePlan.id}
          onSuccess={() => setDeletePlan(null)}
        />
      )}

      {evalTarget && (
        <EvaluationCreateModal
          isOpen
          onClose={() => setEvalTarget(null)}
          studentId={evalTarget.id}
          studentName={evalTarget.name}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-[24px] p-5 border border-border-card shadow-sm text-center">
      <p className="text-xs text-text-muted font-medium mb-2">{label}</p>
      <h3 className="text-xl font-black text-primary">{value}</h3>
    </div>
  );
}
