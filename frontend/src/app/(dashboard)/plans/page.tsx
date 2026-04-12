"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, PlusCircle } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { WeeklyPlanModal } from "@/components/plans/WeeklyPlanModal";
import type { WeeklyPlan } from "@/types/api";

function currentWeekSaturday(): string {
  const d = new Date();
  const weekday = d.getDay(); // 0=Sun
  const daysSinceSat = (weekday + 1) % 7;
  d.setDate(d.getDate() - daysSinceSat);
  return d.toISOString().slice(0, 10);
}

export default function PlansPage() {
  const { user } = useAuth();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [weekFilter, setWeekFilter] = useState<string>("");

  const params = useMemo<Record<string, string | undefined>>(
    () => ({ week_start: weekFilter || undefined }),
    [weekFilter]
  );

  const { data: plans, isLoading, refetch } = useApi<WeeklyPlan[]>(
    "/api/records/weekly-plans/",
    params
  );

  useEffect(() => {
    refetch(params);
  }, [params, refetch]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">خطط التسميع</h1>
            <p className="text-xs text-slate-500">إدارة الخطط الأسبوعية لطلاب الحلقة</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">فلترة بالأسبوع</label>
            <input
              type="date"
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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

      {/* Summary Stats */}
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
              plans.reduce((s, p) => s + (p.completion_rate ?? 0), 0) / plans.length
            )}%`}
          />
        </div>
      )}

      {/* Plans Table */}
      {isLoading && !plans ? (
        <PageLoading />
      ) : (plans ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">لا توجد خطط أسبوعية</p>
          <p className="text-xs text-slate-300 mt-1">أنشئ خطة جديدة لطلابك</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-right">
              <thead className="text-[10px] text-slate-500 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 font-bold">الطالب</th>
                  <th className="px-4 py-3 font-bold text-center">الأسبوع</th>
                  <th className="px-4 py-3 font-bold text-center">بداية الأسبوع</th>
                  <th className="px-4 py-3 font-bold text-center">المطلوب</th>
                  <th className="px-4 py-3 font-bold text-center">المنجز</th>
                  <th className="px-4 py-3 font-bold text-center">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {(plans ?? []).map((plan) => {
                  const rate = plan.completion_rate ?? (plan.total_required > 0
                    ? Math.round((plan.total_achieved / plan.total_required) * 100)
                    : 0);
                  return (
                    <tr key={plan.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                            {plan.student_name?.[0] ?? "?"}
                          </div>
                          <span className="font-bold text-slate-700">{plan.student_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 font-bold">
                        #{plan.week_number}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500" dir="ltr">
                        {plan.week_start}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {plan.total_required}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {plan.total_achieved}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                            rate >= 80
                              ? "bg-green-50 text-green-600"
                              : rate >= 50
                              ? "bg-orange-50 text-orange-600"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {rate}%
                        </span>
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
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onCreated={() => refetch(params)}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
      <p className="text-xs text-slate-500 font-medium mb-2">{label}</p>
      <h3 className="text-xl font-black text-primary">{value}</h3>
    </div>
  );
}
