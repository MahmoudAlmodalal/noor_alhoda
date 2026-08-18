"use client";

import { useMemo, useState } from "react";
import { BookOpen, Edit, PlusCircle, Trash2 } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useQuery } from "@/hooks/useApi";
import { WeeklyPlanModal } from "@/components/plans/WeeklyPlanModal";
import { ConfirmDeleteModal } from "@/components/modals/TeacherModals";
import type { PlanForList } from "@/lib/db/repos/aggregates";

export default function PlansPage() {
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [weekFilter, setWeekFilter] = useState<string>("");
  const [editPlan, setEditPlan] = useState<{
    id: string;
    studentId: string;
    studentName: string;
    requiredPages?: number;
    reviewRequiredPages?: number;
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
            <p className="text-xs text-text-muted">إدارة الخطط الشهرية لطلاب الحلقة</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-text-body">فلترة ببداية الخطة</label>
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
            value={`${Number(plans.reduce((s, p) => s + (p.required_pages || p.total_required_pages || 0), 0).toFixed(1))} صفحة`}
          />
          <SummaryCard
            label="إجمالي المنجز"
            value={`${Number(plans.reduce((s, p) => s + (p.total_pages || 0), 0).toFixed(1))} صفحة`}
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
          <p className="text-sm text-text-muted font-medium">لا توجد خطط شهرية</p>
          <p className="text-xs text-text-muted mt-1">أنشئ خطة جديدة لطلابك</p>
        </div>
      ) : (
        <div className="bg-white rounded-[24px] shadow-sm border border-border-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-right">
              <thead className="text-[10px] text-text-muted bg-surface-subtle/80">
                <tr>
                  <th className="px-4 py-3 font-bold">الطالب</th>
                  <th className="px-4 py-3 font-bold text-center">بداية الخطة</th>
                  <th className="px-4 py-3 font-bold text-center">المطلوب حفظه</th>
                  <th className="px-4 py-3 font-bold text-center">منجز الحفظ</th>
                  <th className="px-4 py-3 font-bold text-center">نسبة الحفظ</th>
                  <th className="px-4 py-3 font-bold text-center">المطلوب مراجعته</th>
                  <th className="px-4 py-3 font-bold text-center">منجز المراجعة</th>
                  <th className="px-4 py-3 font-bold text-center">نسبة المراجعة</th>
                  <th className="px-4 py-3 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(plans ?? []).map((plan) => {
                  const rate = plan.completion_rate;
                  const reqPages = plan.required_pages ?? plan.total_required_pages ?? 0;
                  const achPages = plan.total_pages ?? (plan.total_lines ? Number((plan.total_lines / 15).toFixed(1)) : 0);
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
                      <td className="px-4 py-3 text-center text-text-muted" dir="ltr">
                        {plan.week_start}
                      </td>
                      <td className="px-4 py-3 text-center text-text-label text-xs">
                        <div className="font-bold">{reqPages} صفحة</div>
                      </td>
                      <td className="px-4 py-3 text-center text-text-label text-xs">
                        <div className="font-bold text-primary">{achPages} صفحة</div>
                        <div className="text-[10px] text-text-muted mt-0.5 font-medium">
                          {plan.total_lines} سطر
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-green-50 text-green-600">{rate}%</span>
                      </td>
                      <td className="px-4 py-3 text-center text-text-label text-xs">
                        <div className="font-bold">{plan.review_required_pages} صفحة</div>
                      </td>
                      <td className="px-4 py-3 text-center text-text-label text-xs">
                        <div className="font-bold text-primary">{plan.review_total_pages} صفحة</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 text-primary">{plan.review_completion_rate}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditPlan({
                                id: plan.id,
                                studentId: plan.student_id,
                                studentName: plan.student_name,
                                requiredPages: plan.required_pages ?? plan.total_required_pages,
                                reviewRequiredPages: plan.review_required_pages ?? 0,
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
        initialRequiredPages={editPlan?.requiredPages}
        initialReviewRequiredPages={editPlan?.reviewRequiredPages}
        initialWeekStart={editPlan?.weekStart}
      />

      {deletePlan && (
        <ConfirmDeleteModal
          isOpen={!!deletePlan}
          onClose={() => setDeletePlan(null)}
          targetName={`${deletePlan.name} (خطة شهرية ${plans?.find((r) => r.id === deletePlan.id)?.week_start || ""})`}
          resource="weekly_plan"
          targetId={deletePlan.id}
          onSuccess={() => setDeletePlan(null)}
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
