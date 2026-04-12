"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import type { AttendanceReport, Teacher } from "@/types/api";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const teacherProfileId = user?.teacher_profile?.id;

  const now = new Date();
  const [month, setMonth] = useState<number>(
    Number(searchParams.get("month")) || now.getMonth() + 1
  );
  const [year, setYear] = useState<number>(
    Number(searchParams.get("year")) || now.getFullYear()
  );
  const [teacherId, setTeacherId] = useState<string>(
    searchParams.get("teacher") || (user?.role === "teacher" && teacherProfileId ? teacherProfileId : "")
  );

  const { data: teachers } = useApi<Teacher[]>(isAdmin ? "/api/users/teachers/" : null);

  const params = useMemo<Record<string, string | undefined>>(
    () => ({
      month: String(month),
      year: String(year),
      teacher: teacherId || undefined,
    }),
    [month, year, teacherId]
  );

  const { data, isLoading, refetch } = useApi<AttendanceReport>(
    "/api/reports/attendance/",
    params
  );

  useEffect(() => {
    refetch(params);
    const qs = new URLSearchParams();
    qs.set("month", String(month));
    qs.set("year", String(year));
    if (teacherId) qs.set("teacher", teacherId);
    router.replace(`/reports/attendance?${qs.toString()}`);
  }, [params, refetch, router, month, year, teacherId]);

  const rows = data?.students ?? [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">تقرير الحضور الشهري</h1>
            <p className="text-xs text-slate-500">سجل الحضور التفصيلي</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-4">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {MONTHS_AR.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const y = now.getFullYear() - i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
          {isAdmin && (
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">جميع المحفظين</option>
              {(teachers ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {data?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard label="إجمالي السجلات" value={data.summary.total_records} />
          <SummaryCard label="نسبة الحضور" value={`${data.summary.attendance_rate}%`} />
          <SummaryCard label="عدد الغياب" value={data.summary.absent} />
        </div>
      )}

      {isLoading && rows.length === 0 ? (
        <PageLoading />
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-sm text-slate-400">لا توجد بيانات</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-right">
              <thead className="text-[10px] text-slate-500 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 font-bold">الطالب</th>
                  <th className="px-4 py-3 font-bold text-center">إجمالي الأيام</th>
                  <th className="px-4 py-3 font-bold text-center">أيام الحضور</th>
                  <th className="px-4 py-3 font-bold text-center">أيام الغياب</th>
                  <th className="px-3 py-3 font-bold text-center">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.student_id} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-700">{row.student_name}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.total_days}</td>
                    <td className="px-4 py-3 text-center text-green-700 font-bold">{row.present_days}</td>
                    <td className="px-4 py-3 text-center text-red-600 font-bold">{row.absent_days}</td>
                    <td className="px-3 py-3 text-center font-bold text-primary">{row.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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

export default function AttendanceReportPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReportContent />
    </Suspense>
  );
}
