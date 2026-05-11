"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@/hooks/useApi";
import { WeekPlanSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ClipboardIllustration } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import {
    AttendancePill,
    type AttendanceValue,
} from "@/components/ui/AttendancePill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatTile } from "@/components/ui/StatTile";
import { formatDualDate } from "@/lib/dates/hijri";
import { cn } from "@/lib/utils";
import type { Catchup, HistoryEntry, WeeklySummary } from "@/types/api";
import {
    AlertTriangle,
    ArrowRight,
    BookOpen,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Clock,
    Target,
    TrendingUp,
    UserCheck,
    UserX,
} from "lucide-react";

const DAY_ORDER = ["sat", "sun", "mon", "tue", "wed", "thu"] as const;
type DayKey = (typeof DAY_ORDER)[number];
const DAY_LABELS: Record<DayKey, string> = {
    sat: "السبت",
    sun: "الأحد",
    mon: "الاثنين",
    tue: "الثلاثاء",
    wed: "الأربعاء",
    thu: "الخميس",
};

const QUALITY_LABELS: Record<string, string> = {
    excellent: "ممتاز",
    good: "جيد جداً",
    acceptable: "جيد",
    weak: "ضعيف",
    none: "-",
};

function getSaturdayDate(d: Date): Date {
    const day = d.getDay();
    const diff = (day + 1) % 7;
    const sat = new Date(d);
    sat.setDate(d.getDate() - diff);
    sat.setHours(0, 0, 0, 0);
    return sat;
}

function isoDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function weekdayAt(saturday: Date, offset: number): Date {
    const d = new Date(saturday);
    d.setDate(saturday.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    return d;
}

function CatchupBanner({ catchup }: { catchup: Catchup }) {
    return (
        <div className="motion-fade-up rounded-[20px] border border-attend-late-text/20 bg-attend-late-bg/30 p-4">
            <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-attend-late-text" />
                <div className="flex-1">
                    <h3 className="text-[14px] font-bold text-text-body">
                        يوجد عجز قدره {catchup.deficit} صفحة
                    </h3>
                    <p className="text-[11px] text-text-muted">
                        اقتراح توزيع غير ملزم — المحفظ يحتفظ بصلاحية الخطة
                    </p>
                </div>
            </div>
            {catchup.suggested_per_day.length > 0 && (
                <div className="mb-3 grid grid-cols-3 gap-2">
                    {catchup.suggested_per_day
                        .filter((s) => s.topup > 0)
                        .map((s) => (
                            <div
                                key={s.date}
                                className="rounded-[10px] bg-white border border-attend-late-text/20 px-2 py-2 text-center"
                            >
                                <div className="text-[11px] text-text-muted">
                                    {s.day}
                                </div>
                                <div className="text-[14px] font-bold text-attend-late-text">
                                    +{s.topup}
                                </div>
                            </div>
                        ))}
                </div>
            )}
            {catchup.weak_surahs.length > 0 && (
                <div className="border-t border-attend-late-text/20 pt-3">
                    <p className="mb-2 text-[11px] font-bold text-text-body">
                        سور تحتاج مراجعة:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {catchup.weak_surahs.map((w) => (
                            <Link
                                key={w.surah_name}
                                href="/student/tasks"
                                className="inline-flex items-center gap-1 rounded-[8px] bg-white px-2 py-1 text-[11px] font-bold text-text-body border border-border-card hover:border-primary"
                            >
                                <BookOpen className="h-3 w-3" />
                                {w.surah_name}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function DayCard({
    dayKey,
    date,
    record,
    isToday,
    isFuture,
}: {
    dayKey: DayKey;
    date: Date;
    record?: HistoryEntry;
    isToday: boolean;
    isFuture: boolean;
}) {
    const attendance = (record?.attendance ??
        (isFuture ? "upcoming" : "absent")) as AttendanceValue;
    const required = record?.required_verses ?? 0;
    const achieved = record?.achieved_verses ?? 0;
    const quality = record?.quality ?? "none";
    const dayPct =
        required > 0 ? Math.round((achieved / required) * 100) : 0;

    const quality_color =
        quality === "excellent"
            ? "text-success-text"
            : quality === "good"
              ? "text-primary"
              : quality === "acceptable"
                ? "text-[#ca3500]"
                : quality === "weak"
                  ? "text-attend-absent-text"
                  : "text-text-muted";

    const gregorianShort = date.toLocaleDateString("ar-EG", {
        day: "numeric",
        month: "short",
    });

    return (
        <div
            className={cn(
                "rounded-[16px] border bg-white p-4 shadow-[var(--shadow-xs)]",
                isToday
                    ? "border-secondary ring-2 ring-secondary/30"
                    : "border-border-card",
            )}
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex flex-col">
                    <span className="text-[14px] font-bold text-text-title">
                        {DAY_LABELS[dayKey]}
                    </span>
                    <span className="text-[10px] text-text-muted">
                        {gregorianShort}
                    </span>
                </div>
                <AttendancePill value={attendance} />
            </div>

            {record?.surah_name ? (
                <p className="mb-2 text-[13px] font-bold text-text-body truncate">
                    {record.surah_name}
                </p>
            ) : (
                <p className="mb-2 text-[12px] text-text-muted">
                    {isFuture ? "قادم" : "لا يوجد سورة مسجلة"}
                </p>
            )}

            {required > 0 && (
                <>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
                        <span>
                            {achieved} / {required} صفحة
                        </span>
                        <span className="font-bold">{dayPct}%</span>
                    </div>
                    <ProgressBar value={dayPct} size="sm" />
                </>
            )}

            {quality !== "none" && (
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-text-muted">التقييم</span>
                    <span className={cn("text-[12px] font-bold", quality_color)}>
                        {QUALITY_LABELS[quality] ?? "-"}
                    </span>
                </div>
            )}

            {record?.note && (
                <p className="mt-2 text-[11px] text-text-muted border-t border-border-card pt-2 line-clamp-2">
                    {record.note}
                </p>
            )}
        </div>
    );
}

function HistoryMiniChart({ weeks }: { weeks: HistoryEntry[] }) {
    if (weeks.length === 0) return null;

    const chartWeeks = weeks.slice(0, 6).reverse();
    const maxRate = Math.max(
        100,
        ...chartWeeks.map((w) => {
            const req = w.required_verses ?? 0;
            const ach = w.achieved_verses ?? 0;
            return req > 0 ? Math.round((ach / req) * 100) : 0;
        }),
    );

    const chartHeight = 80;

    return (
        <div className="rounded-[20px] border border-border-card bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="text-[14px] font-bold text-text-body">
                    آخر {chartWeeks.length} أسابيع
                </h3>
            </div>
            <div className="flex items-end justify-center gap-2.5">
                {chartWeeks.map((w, i) => {
                    const req = w.required_verses ?? 0;
                    const ach = w.achieved_verses ?? 0;
                    const pct =
                        req > 0 ? Math.round((ach / req) * 100) : 0;
                    const height = (pct / maxRate) * chartHeight;
                    const tone =
                        pct >= 80
                            ? "bg-success-text"
                            : pct >= 50
                              ? "bg-primary"
                              : pct > 0
                                ? "bg-attend-late-text"
                                : "bg-border-card";
                    return (
                        <div
                            key={`${w.date}-${i}`}
                            className="flex flex-col items-center gap-1"
                            title={`${pct}%`}
                        >
                            <span className="text-[10px] font-bold text-text-muted">
                                {pct}%
                            </span>
                            <div
                                className={cn(
                                    "w-7 rounded-t-[6px] transition-all",
                                    tone,
                                )}
                                style={{
                                    height: `${Math.max(4, height)}px`,
                                }}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 h-px bg-border-card" />
            <p className="mt-2 text-center text-[10px] text-text-muted">
                نسبة الإنجاز الأسبوعية
            </p>
        </div>
    );
}

export default function StudentPlanPage() {
    const { user } = useAuth();
    const studentProfileId = user?.student_profile?.id;

    const [weekOffset, setWeekOffset] = useState(0);

    const { currentSaturday, weekStart } = useMemo(() => {
        const base = getSaturdayDate(new Date());
        const cs = new Date(base);
        cs.setDate(base.getDate() + weekOffset * 7);
        return { currentSaturday: cs, weekStart: isoDay(cs) };
    }, [weekOffset]);

    const { data: summary, isLoading } = useQuery<WeeklySummary>(
        studentProfileId ? "weekly_summary" : null,
        studentProfileId
            ? { student_id: studentProfileId, week_start: weekStart }
            : undefined,
    );

    const { data: history } = useQuery<HistoryEntry[]>(
        studentProfileId ? "student_history" : null,
        studentProfileId ? { student_id: studentProfileId } : undefined,
    );

    if (isLoading) {
        return (
            <div className="mx-auto max-w-md p-4" dir="rtl">
                <WeekPlanSkeleton />
            </div>
        );
    }

    const isCurrentWeek = weekOffset === 0;
    const satDual = formatDualDate(currentSaturday);
    const thursday = weekdayAt(currentSaturday, 5);
    const thuDual = formatDualDate(thursday);

    const recordByDay = new Map<string, HistoryEntry>(
        (summary?.records ?? []).map((r) => [(r.day as string) ?? "", r]),
    );
    const todayKey = (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[
        new Date().getDay()
    ];
    const todayIsoDate = isoDay(new Date());

    const totalRequired = summary?.total_required ?? 0;
    const totalAchieved = summary?.total_achieved ?? 0;
    const completionRate = summary?.completion_rate ?? 0;

    const attendanceCounts = {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
    };
    (summary?.records ?? []).forEach((r) => {
        if (r.attendance in attendanceCounts) {
            attendanceCounts[r.attendance as keyof typeof attendanceCounts] += 1;
        }
    });

    return (
        <div className="mx-auto max-w-md space-y-5 pb-24 px-1" dir="rtl">
            {/* Week navigator */}
            <div className="flex items-center justify-between gap-2 rounded-[16px] border border-border-card bg-white p-2 shadow-sm">
                <button
                    type="button"
                    onClick={() => setWeekOffset((o) => o - 1)}
                    className="flex items-center gap-1 rounded-[10px] px-3 py-2 text-[12px] font-bold text-text-muted hover:bg-surface-subtle hover:text-text-body transition-colors"
                >
                    <ChevronRight className="h-4 w-4" />
                    السابق
                </button>
                <button
                    type="button"
                    onClick={() => setWeekOffset(0)}
                    disabled={isCurrentWeek}
                    className={cn(
                        "flex items-center gap-1 rounded-[10px] px-3 py-2 text-[12px] font-bold transition-colors",
                        isCurrentWeek
                            ? "bg-primary text-white cursor-default"
                            : "text-primary hover:bg-tile-blue",
                    )}
                >
                    <Calendar className="h-4 w-4" />
                    الأسبوع الحالي
                </button>
                <button
                    type="button"
                    onClick={() => setWeekOffset((o) => o + 1)}
                    disabled={isCurrentWeek}
                    className={cn(
                        "flex items-center gap-1 rounded-[10px] px-3 py-2 text-[12px] font-bold transition-colors",
                        isCurrentWeek
                            ? "text-text-muted/40 cursor-not-allowed"
                            : "text-text-muted hover:bg-surface-subtle hover:text-text-body",
                    )}
                >
                    التالي
                    <ChevronLeft className="h-4 w-4" />
                </button>
            </div>

            {/* Hero */}
            <div className="motion-fade-up rounded-[24px] border border-border-card bg-white p-5 shadow-sm">
                <div className="mb-3">
                    <h1 className="text-[18px] font-bold text-text-title">
                        الخطة الأسبوعية
                    </h1>
                    <p className="text-[12px] text-text-muted">
                        {satDual.gregorian} — {thuDual.gregorian}
                    </p>
                    <p className="text-[11px] text-text-muted">
                        {satDual.hijri} — {thuDual.hijri}
                    </p>
                </div>
                {summary && summary.records && summary.records.length > 0 ? (
                    <div className="flex items-center gap-5">
                        <ProgressRing
                            value={completionRate}
                            size="md"
                            tone={
                                completionRate >= 80
                                    ? "success"
                                    : completionRate >= 50
                                      ? "primary"
                                      : completionRate > 0
                                        ? "warning"
                                        : "danger"
                            }
                            sublabel="الإنجاز"
                        />
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] text-text-muted">
                                    الإجمالي المطلوب
                                </span>
                                <span className="text-[14px] font-bold text-text-body">
                                    {totalRequired} صفحة
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] text-text-muted">
                                    الإجمالي المنجز
                                </span>
                                <span className="text-[14px] font-bold text-success-text">
                                    {totalAchieved} صفحة
                                </span>
                            </div>
                            {summary.week_number ? (
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] text-text-muted">
                                        رقم الأسبوع
                                    </span>
                                    <span className="text-[14px] font-bold text-primary">
                                        #{summary.week_number}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <EmptyState
                        title="لا توجد خطة لهذا الأسبوع"
                        description="تواصل مع معلمك لتحديد خطة الحفظ والمراجعة."
                        illustration={<ClipboardIllustration size={80} />}
                        tone="soft"
                    />
                )}
            </div>

            {summary?.catchup ? <CatchupBanner catchup={summary.catchup} /> : null}

            {summary && summary.records && summary.records.length > 0 ? (
                <>
                    {/* Attendance stat tiles */}
                    <div className="grid grid-cols-4 gap-2">
                        <StatTile
                            icon={<UserCheck className="h-4 w-4 text-success-text" />}
                            tileBg="green"
                            label="حاضر"
                            value={attendanceCounts.present}
                        />
                        <StatTile
                            icon={<Clock className="h-4 w-4 text-attend-late-text" />}
                            tileBg="yellow"
                            label="متأخر"
                            value={attendanceCounts.late}
                        />
                        <StatTile
                            icon={<UserX className="h-4 w-4 text-danger-text" />}
                            tileBg="red"
                            label="غائب"
                            value={attendanceCounts.absent}
                        />
                        <StatTile
                            icon={<Target className="h-4 w-4 text-primary" />}
                            tileBg="blue"
                            label="مستأذن"
                            value={attendanceCounts.excused}
                        />
                    </div>

                    {/* Day grid */}
                    <div className="grid grid-cols-1 gap-3">
                        {DAY_ORDER.map((dayKey, i) => {
                            const date = weekdayAt(currentSaturday, i);
                            const iso = isoDay(date);
                            const record = recordByDay.get(dayKey);
                            const isToday = isCurrentWeek && dayKey === todayKey;
                            const isFuture = iso > todayIsoDate;
                            return (
                                <DayCard
                                    key={dayKey}
                                    dayKey={dayKey}
                                    date={date}
                                    record={record}
                                    isToday={isToday}
                                    isFuture={isFuture}
                                />
                            );
                        })}
                    </div>
                </>
            ) : null}

            {/* History chart */}
            <HistoryMiniChart weeks={history ?? []} />

            {/* Back to dashboard */}
            <Link
                href="/student"
                className="flex items-center justify-center gap-2 rounded-[14px] border border-border-card bg-white py-3 text-[13px] font-bold text-text-muted hover:text-text-body hover:border-primary transition-colors"
            >
                <ArrowRight className="h-4 w-4" />
                العودة للوحة
            </Link>
        </div>
    );
}
