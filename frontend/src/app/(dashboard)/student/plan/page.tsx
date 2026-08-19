"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, ClipboardList, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@/hooks/useApi";
import { WeekPlanSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ClipboardIllustration } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AttendancePill, type AttendanceValue } from "@/components/ui/AttendancePill";
import { cn } from "@/lib/utils";
import type { HistoryEntry, MonthlySummary } from "@/types/api";

function monthStartFor(offset: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(monthStart: string): string {
  return new Date(`${monthStart}T00:00:00`).toLocaleDateString("ar-EG", {
    month: "long",
    year: "numeric",
  });
}

function dateLabel(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function MonthlyRecordCard({ record }: { record: HistoryEntry }) {
  const attendance = (record.attendance ?? "upcoming") as AttendanceValue;
  const required = record.required_verses ?? 0;
  const achieved = record.achieved_verses ?? 0;
  const percentage = required > 0 ? Math.min(100, Math.round((achieved / required) * 100)) : 0;

  return (
    <div className="rounded-[16px] border border-border-card bg-white p-4 shadow-[var(--shadow-xs)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold text-text-title">{dateLabel(record.date)}</p>
          <p className="text-[10px] text-text-muted">{record.surah_name || "لا توجد سورة مسجلة"}</p>
        </div>
        <AttendancePill value={attendance} />
      </div>
      {required > 0 && (
        <>
          <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
            <span>{achieved} / {required} آية</span>
            <span className="font-bold">{percentage}%</span>
          </div>
          <ProgressBar value={percentage} size="sm" />
        </>
      )}
      {(record.memorized_lines ?? 0) > 0 && (
        <p className="mt-2 text-[11px] text-text-muted">{record.memorized_lines} سطر محفوظ</p>
      )}
      {record.note && (
        <p className="mt-2 border-t border-border-card pt-2 text-[11px] text-text-muted line-clamp-2">
          {record.note}
        </p>
      )}
    </div>
  );
}

export default function StudentPlanPage() {
  const { user } = useAuth();
  const studentProfileId = user?.student_profile?.id;
  const [monthOffset, setMonthOffset] = useState(0);
  const monthStart = useMemo(() => monthStartFor(monthOffset), [monthOffset]);
  const isCurrentMonth = monthOffset === 0;

  const { data: summary, isLoading } = useQuery<MonthlySummary>(
    studentProfileId ? "monthly_summary" : null,
    studentProfileId ? { student_id: studentProfileId, month_start: monthStart } : undefined,
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md p-4" dir="rtl">
        <WeekPlanSkeleton />
      </div>
    );
  }

  const records = summary?.records ?? [];
  const totalPages = ((summary?.total_lines ?? 0) / 15).toFixed(1);
  const completionRate = summary?.completion_rate ?? 0;
  const presentDays = records.filter((r) => r.attendance === "present" || r.attendance === "late").length;
  const pendingDays = records.filter((r) => r.attendance === "absent").length;

  return (
    <div className="mx-auto max-w-md space-y-5 px-1 pb-24" dir="rtl">
      <div className="flex items-center justify-between gap-2 rounded-[16px] border border-border-card bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setMonthOffset((value) => value - 1)}
          className="flex items-center gap-1 rounded-[10px] px-3 py-2 text-[12px] font-bold text-text-muted hover:bg-surface-subtle hover:text-text-body"
        >
          <ChevronRight className="h-4 w-4" />
          السابق
        </button>
        <button
          type="button"
          onClick={() => setMonthOffset(0)}
          disabled={isCurrentMonth}
          className={cn(
            "flex items-center gap-1 rounded-[10px] px-3 py-2 text-[12px] font-bold",
            isCurrentMonth ? "bg-primary text-white" : "text-primary hover:bg-tile-blue",
          )}
        >
          <Calendar className="h-4 w-4" />
          الشهر الحالي
        </button>
        <button
          type="button"
          onClick={() => setMonthOffset((value) => value + 1)}
          className="flex items-center gap-1 rounded-[10px] px-3 py-2 text-[12px] font-bold text-text-muted hover:bg-surface-subtle hover:text-text-body"
        >
          التالي
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="motion-fade-up rounded-[24px] border border-border-card bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h1 className="text-[18px] font-bold text-text-title">الخطة الشهرية</h1>
          <p className="text-[13px] font-bold text-primary">{monthLabel(monthStart)}</p>
          <p className="text-[11px] text-text-muted">
            {summary?.month_start ?? monthStart} — {summary?.month_end ?? monthStart}
          </p>
        </div>

        {summary && records.length > 0 ? (
          <div className="flex items-center gap-5">
            <ProgressRing
              value={completionRate}
              size="md"
              tone={completionRate >= 80 ? "success" : completionRate >= 50 ? "primary" : "warning"}
              sublabel="إنجاز الشهر"
            />
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-text-muted">الإجمالي المطلوب</span>
                <span className="font-bold text-text-body">{summary.total_required} آية</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-text-muted">الإجمالي المنجز</span>
                <span className="font-bold text-success-text">{summary.total_achieved} آية</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-text-muted">الصفحات المحفوظة</span>
                <span className="font-bold text-purple-600">{totalPages} صفحة</span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="لا توجد خطة لهذا الشهر"
            description="تواصل مع المحفظ لتحديد خطة الحفظ والمراجعة الشهرية."
            illustration={<ClipboardIllustration size={80} />}
            tone="soft"
          />
        )}
      </div>

      {records.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[16px] border border-border-card bg-white p-4 text-center shadow-sm">
              <Target className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-[11px] text-text-muted">أيام الحضور</p>
              <p className="text-xl font-black text-primary">{presentDays}</p>
            </div>
            <div className="rounded-[16px] border border-border-card bg-white p-4 text-center shadow-sm">
              <ClipboardList className="mx-auto mb-1 h-5 w-5 text-attend-late-text" />
              <p className="text-[11px] text-text-muted">أيام الغياب</p>
              <p className="text-xl font-black text-attend-late-text">{pendingDays}</p>
            </div>
          </div>
          <div className="space-y-3">
            {records.map((record) => <MonthlyRecordCard key={record.id || record.date} record={record} />)}
          </div>
        </>
      )}

      <Link
        href="/student"
        className="flex items-center justify-center gap-2 rounded-[14px] border border-border-card bg-white py-3 text-[13px] font-bold text-text-muted hover:border-primary hover:text-text-body"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للوحة
      </Link>
    </div>
  );
}
