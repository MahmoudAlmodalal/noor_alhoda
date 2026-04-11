"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import type { AttendanceReport, AttendanceStatus, Teacher } from "@/types/api";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-orange-100 text-orange-700",
  excused: "bg-blue-100 text-blue-700",
};

const STATUS_SHORT: Record<AttendanceStatus, string> = {
  present: "ح",
  absent: "غ",
  late: "م",
  excused: "ع",
};

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const now = new Date();
  const [month, setMonth] = useState<number>(
    Number(searchParams.get("month")) || now.getMonth() + 1
  );
  const [year, setYear] = useState<number>(
    Number(searchParams.get("year")) || now.getFullYear()
  );
  const [teacherId, setTeacherId] = useState<string>(
    searchParams.get("teacher") || (user?.role === "teacher" && user.id ? user.id : "")
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

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayKeys = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));
  const rows = data?.rows ?? [];

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
                <option key={t.id} value={t.user_id}>{t.full_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {data?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard label="إجمالي الجلسات" value={data.summary.total_sessions ?? "—"} />
          <SummaryCard label="متوسط الحضور" value={data.summary.avg_attendance != null ? `${data.summary.avg_attendance}%` : "—"} />
          <SummaryCard label="الأكثر غياباً" value={data.summary.most_absent_student ?? "—"} />
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
            <table className="text-xs text-right">
              <thead className="text-[10px] text-slate-500 bg-slate-50/80">
                <tr>
                  <th className="px-3 py-3 font-bold sticky right-0 bg-slate-50 min-w-[140px]">الطالب</th>
                  {dayKeys.map((d) => (
                    <th key={d} className="px-2 py-3 font-bold text-center">{d}</th>
                  ))}
                  <th className="px-3 py-3 font-bold text-center">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.student_id} className="border-b border-slate-50">
                    <td className="px-3 py-2 font-bold text-slate-700 sticky right-0 bg-white">{row.student_name}</td>
                    {dayKeys.map((d) => {
                      const status = row.days?.[d];
                      return (
                        <td key={d} className="px-1 py-2 text-center">
                          {status ? (
                            <span className={`inline-block w-6 h-6 leading-6 rounded text-[10px] font-bold ${STATUS_COLORS[status]}`}>
                              {STATUS_SHORT[status]}
                            </span>
                          ) : (
                            <span className="text-slate-300">·</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-bold text-primary">{row.rate}%</td>
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
