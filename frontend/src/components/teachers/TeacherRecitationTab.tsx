"use client";

import { useMemo, useState } from "react";
import { BookOpen, Calendar, Inbox } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  AttendancePill,
  type AttendanceValue,
} from "@/components/ui/AttendancePill";
import { QualityBadge } from "@/components/ui/QualityBadge";
import { ResultBadge } from "@/components/ui/ResultBadge";
import { useQuery } from "@/hooks/useApi";
import type { DailyRecordWithStudent } from "@/lib/db/repos/aggregates";
import { cn } from "@/lib/utils";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  teacherId: string;
  initialStudentId?: string | null;
}

export function TeacherRecitationTab({ teacherId, initialStudentId }: Props) {
  const [date, setDate] = useState(todayIso());
  const { data: records, isLoading } = useQuery<DailyRecordWithStudent[]>(
    "daily_records_with_student",
    { date, teacher_id: teacherId }
  );

  const list = useMemo(() => {
    const rows = (records ?? []).slice();
    if (initialStudentId) {
      rows.sort((a, b) => {
        if (a.student_id === initialStudentId) return -1;
        if (b.student_id === initialStudentId) return 1;
        return a.student_name.localeCompare(b.student_name, "ar");
      });
    } else {
      rows.sort((a, b) => a.student_name.localeCompare(b.student_name, "ar"));
    }
    return rows;
  }, [records, initialStudentId]);

  const totals = useMemo(() => {
    const rows = records ?? [];
    const required = rows.reduce((s, r) => s + (r.required_verses || 0), 0);
    const achieved = rows.reduce((s, r) => s + (r.achieved_verses || 0), 0);
    const rate = required > 0 ? Math.round((achieved / required) * 100) : 0;
    return { required, achieved, rate, count: rows.length };
  }, [records]);

  return (
    <section className="overflow-hidden rounded-[24px] border border-border-card bg-white shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex flex-col gap-3 border-b border-border-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-text-body">
            سجل التسميع
            <span className="ms-2 text-xs font-medium text-text-muted">
              ({totals.count})
            </span>
          </h2>
        </div>
        <label className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-muted" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            dir="ltr"
            className="h-10 rounded-[10px] border border-border-subtle bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="تاريخ السجل"
          />
        </label>
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

      {isLoading && !records ? (
        <div className="px-5 py-12 text-center text-sm text-text-muted">
          جارٍ التحميل...
        </div>
      ) : list.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="text-sm font-medium text-text-muted">
            لا توجد سجلات تسميع لهذا التاريخ.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface-subtle/80 text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-bold">الطالب</th>
                <th className="px-4 py-3 font-bold">الحضور</th>
                <th className="px-4 py-3 font-bold">سورة الحفظ</th>
                <th className="px-4 py-3 font-bold">إنجاز الحفظ</th>
                <th className="px-4 py-3 font-bold">جودة الحفظ</th>
                <th className="px-4 py-3 font-bold">سورة المراجعة</th>
                <th className="px-4 py-3 font-bold">آيات المراجعة</th>
                <th className="px-4 py-3 font-bold">جودة المراجعة</th>
                <th className="px-4 py-3 font-bold">النتيجة</th>
                <th className="px-4 py-3 font-bold">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const rate =
                  r.required_verses > 0
                    ? Math.round((r.achieved_verses / r.required_verses) * 100)
                    : 0;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border-card last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={r.student_name} size={28} />
                        <span className="font-semibold text-text-body">
                          {r.student_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AttendancePill value={r.attendance as AttendanceValue} />
                    </td>
                    <td className="px-4 py-3 text-text-label">
                      {r.surah_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.required_verses > 0 ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-text-body">
                            {r.achieved_verses} / {r.required_verses} ({rate}%)
                          </span>
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
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <QualityBadge value={r.quality} />
                    </td>
                    <td className="px-4 py-3 text-text-label">
                      {r.review_surah_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-text-label">
                      {r.review_from_ayah || r.review_to_ayah ? (
                        <span className="text-xs font-bold text-text-body">
                          {r.review_from_ayah ?? "1"} - {r.review_to_ayah ?? "الأخير"}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <QualityBadge value={r.review_quality ?? "none"} />
                    </td>
                    <td className="px-4 py-3">
                      <ResultBadge value={r.result} />
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      {r.note ? (
                        <span
                          title={r.note}
                          className="line-clamp-1 text-xs text-text-muted"
                        >
                          {r.note}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
