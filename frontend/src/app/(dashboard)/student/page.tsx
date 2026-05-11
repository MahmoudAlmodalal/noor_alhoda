"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@/hooks/useApi";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Countdown } from "@/components/ui/Countdown";
import {
    AttendancePill,
    type AttendanceValue,
} from "@/components/ui/AttendancePill";
import { ResultPill, type ResultValue } from "@/components/ui/ResultPill";
import { Pattern } from "@/components/ui/Pattern";
import type { StudentWithTeacher } from "@/hooks/queries";
import type {
    HistoryEntry,
    StudentStats,
    TodayTasks,
    WeeklySummary,
} from "@/types/api";
import { formatDualDate } from "@/lib/dates/hijri";
import { isPerfectAttendance } from "@/lib/utils/streak";
import { BadgeStrip } from "@/components/student/BadgeStrip";
import {
    Award,
    BookOpen,
    Calendar,
    ChevronLeft,
    Clock,
    Flame,
    ListChecks,
    Sparkles,
    Star,
    Target,
    Trophy,
} from "lucide-react";

type Attendance = AttendanceValue;
type ResultKey = ResultValue;
type Quality = "excellent" | "good" | "acceptable" | "weak" | "none";

interface WeeklyRow {
    day: string;
    attendance: Attendance;
    required: string;
    achieved: string;
    evaluation: Quality;
    result: ResultKey;
}

type HistoryRow = HistoryEntry & {
    rating?: "excellent" | "very_good" | "good" | "none";
    title?: string;
};

function getSaturday(date: Date): string {
    const day = date.getDay();
    const diff = (day + 1) % 7;
    const saturday = new Date(date);
    saturday.setDate(date.getDate() - diff);
    return saturday.toISOString().split("T")[0];
}

const QUALITY_LABELS: Record<string, string> = {
    excellent: "ممتاز",
    good: "جيد جداً",
    acceptable: "جيد",
    weak: "ضعيف",
    none: "-",
};

const QUALITY_STARS: Record<string, number> = {
    excellent: 3,
    good: 2,
    acceptable: 1,
    weak: 0,
    none: 0,
};

function RatingText({ value }: { value: Quality }) {
    if (value === "excellent") {
        return (
            <span className="text-[16px] font-bold text-success-text">ممتاز</span>
        );
    }
    if (value === "good") {
        return <span className="text-[16px] font-bold text-primary">جيد جداً</span>;
    }
    if (value === "acceptable") {
        return (
            <span className="text-[16px] font-bold text-[#ca3500]">جيد</span>
        );
    }
    if (value === "weak") {
        return (
            <span className="text-[16px] font-bold text-attend-absent-text">
                ضعيف
            </span>
        );
    }
    return <span className="text-[16px] font-bold text-text-muted">-</span>;
}

function RatingPill({ value }: { value: string }) {
    if (value === "excellent") {
        return (
            <span className="inline-block rounded-[10px] bg-attend-present-bg px-3 py-1 text-[14px] font-bold text-attend-present-text">
                ممتاز
            </span>
        );
    }
    if (value === "very_good") {
        return (
            <span className="inline-block rounded-[10px] bg-[#dbeafe] px-3 py-1 text-[14px] font-bold text-[#1447e6]">
                جيد جداً
            </span>
        );
    }
    if (value === "good") {
        return (
            <span className="inline-block rounded-[10px] bg-[#ffedd4] px-3 py-1 text-[14px] font-bold text-[#ca3500]">
                جيد
            </span>
        );
    }
    return null;
}

export default function StudentDashboard() {
    const { user } = useAuth();
    const studentProfileId = user?.student_profile?.id;

    const { data: profile, isLoading: isProfileLoading } = useQuery<StudentWithTeacher>(
        studentProfileId ? "student" : null,
        studentProfileId ? { id: studentProfileId } : undefined
    );

    const { data: stats, isLoading: isStatsLoading } = useQuery<StudentStats>(
        studentProfileId ? "student_stats" : null,
        studentProfileId ? { student_id: studentProfileId } : undefined
    );

    const { data: weeklyPlan } = useQuery<WeeklySummary>(
        studentProfileId ? "weekly_summary" : null,
        studentProfileId
            ? { student_id: studentProfileId, week_start: getSaturday(new Date()) }
            : undefined
    );

    const { data: tasks } = useQuery<TodayTasks>(
        studentProfileId ? "tasks_today" : null,
        studentProfileId ? { student_id: studentProfileId } : undefined
    );

    const { data: history } = useQuery<HistoryRow[]>(
        studentProfileId ? "student_history" : null,
        studentProfileId ? { student_id: studentProfileId } : undefined
    );

    if (isProfileLoading || isStatsLoading) {
        return (
            <div className="mx-auto max-w-md p-4" dir="rtl">
                <DashboardSkeleton />
            </div>
        );
    }

    const firstName =
        profile?.full_name?.split(" ")[0] ||
        user?.full_name?.split(" ")[0] ||
        "طالب";
    const fullName = profile?.full_name || user?.full_name || "";
    const memorizationLevel = stats?.memorization_level || "-";
    const subtitleParts = [
        profile?.grade || "",
        profile?.teacher_name ? `الشيخ ${profile.teacher_name}` : "",
    ].filter(Boolean);

    const points = stats?.points ?? 0;
    const memorizedParts = stats?.memorized_parts ?? 0;
    const streak = stats?.streak ?? 0;
    const absentDays = stats?.total_absent ?? 0;
    const studyDays = stats?.total_present ?? 0;
    const currentGoal = stats?.current_goal || "لم يتم تحديد هدف بعد";
    const goalProgress = stats?.goal_progress ?? 0;

    const planRows: WeeklyRow[] = (weeklyPlan?.records ?? []).map((r) => {
        const q = (r.quality ?? "none") as Quality;
        const achieved = Number(r.achieved_verses ?? 0);
        const required = Number(r.required_verses ?? 0);
        let derivedResult: ResultKey = "pending";
        if (r.attendance && q !== "none") {
            const passed =
                (q === "excellent" || q === "good" || q === "acceptable") &&
                achieved >= required;
            derivedResult = passed ? "pass" : "fail";
        }
        return {
            day: r.day ?? "",
            attendance: (r.attendance ?? "upcoming") as Attendance,
            required: String(required),
            achieved: String(achieved),
            evaluation: q,
            result: derivedResult,
        };
    });
    const historyRows: HistoryRow[] = history?.length ? history : [];
    const todayRecord = stats?.today_record;

    const today = new Date();
    const dual = formatDualDate(today);

    const reviews = tasks?.reviews ?? [];
    const reviewInterval = tasks?.review_interval_days ?? 14;
    const overdueCount = reviews.filter((r) => r.days_since_review > reviewInterval).length;
    const dueTodayCount = reviews.length;

    const nextTest = (tasks?.upcoming_tests ?? [])
        .slice()
        .sort((a, b) =>
            a.scheduled_date.localeCompare(b.scheduled_date),
        )[0];

    const weeklyCompletion = weeklyPlan
        ? weeklyPlan.total_required > 0
            ? Math.round(
                  (weeklyPlan.total_achieved / weeklyPlan.total_required) * 100,
              )
            : 0
        : 0;

    return (
        <div className="mx-auto max-w-md space-y-5 pb-24 px-1" dir="rtl">
            {/* 1. Dual-date strip */}
            <div className="motion-fade-up flex items-center justify-between gap-3 rounded-[16px] border border-border-card bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-col">
                    <span className="text-[18px] font-bold text-text-title leading-tight">
                        {dual.hijri}
                    </span>
                    <span className="text-[12px] text-text-muted">
                        {dual.weekday} · {dual.gregorian}
                    </span>
                </div>
                {streak >= 3 && (
                    <div className="flex items-center gap-1 rounded-full bg-tile-yellow border border-secondary/30 px-3 py-1.5">
                        <Flame className="h-4 w-4 text-secondary" />
                        <span className="text-[12px] font-bold text-text-body">
                            {streak} يوم
                        </span>
                    </div>
                )}
            </div>

            {/* 2. Primary gradient hero with Islamic pattern */}
            <div
                className="motion-fade-up relative overflow-hidden rounded-[24px] p-6 text-white shadow-lg shadow-primary/20"
                style={{ background: "linear-gradient(135deg, #0b5394, #083d73)", animationDelay: "60ms" }}
            >
                <Pattern kind="star8" color="#eabd5b" opacity={0.3} size={50} />
                <div className="relative">
                    <p className="text-[12px] text-white/80">السلام عليكم، {firstName}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-[64px] font-extrabold leading-none">
                            {memorizedParts}
                        </span>
                        <span className="text-[18px] text-white/90">جزء</span>
                        <span className="ms-auto text-[32px]">✨</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-secondary fill-secondary" />
                        <span className="text-[13px] text-white/90">
                            نقاطك:{" "}
                            <strong className="text-white">
                                {points.toLocaleString("ar-SA")}
                            </strong>
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. Level + name summary */}
            <div className="flex items-center justify-between gap-4 rounded-[20px] border border-border-card bg-white p-5 shadow-sm">
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="text-[18px] font-bold leading-7 text-text-title truncate">
                        {fullName}
                    </h2>
                    {subtitleParts.length > 0 && (
                        <p className="text-[13px] text-text-muted truncate">
                            {subtitleParts.join(" • ")}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-[10px] border border-primary/20 bg-tile-blue px-3 py-2">
                    <Award className="h-5 w-5 text-primary" />
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] text-text-muted">المستوى</span>
                        <span className="text-[13px] font-bold text-primary">
                            {memorizationLevel}
                        </span>
                    </div>
                </div>
            </div>

            {/* 4. Today focus — today's memorization */}
            {tasks?.memorization ? (
                <Link
                    href="/student/tasks"
                    className="motion-fade-up block rounded-[20px] border border-border-card bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            <h3 className="text-[15px] font-bold text-text-body">
                                حفظ اليوم
                            </h3>
                        </div>
                        <AttendancePill value={(tasks.memorization.attendance ?? "upcoming") as AttendanceValue} />
                    </div>
                    <p className="mb-3 text-[17px] font-bold text-text-title">
                        {tasks.memorization.surah_name || "سيُحدد قريباً"}
                    </p>
                    <div className="mb-2 flex items-center justify-between text-[12px] text-text-muted">
                        <span>
                            المنجز {tasks.memorization.achieved_verses} من{" "}
                            {tasks.memorization.required_verses} صفحة
                        </span>
                        <ChevronLeft className="h-4 w-4" />
                    </div>
                    <ProgressBar
                        value={
                            tasks.memorization.required_verses > 0
                                ? Math.round(
                                      (tasks.memorization.achieved_verses /
                                          tasks.memorization.required_verses) *
                                          100,
                                  )
                                : 0
                        }
                        size="sm"
                    />
                </Link>
            ) : null}

            {/* 5. Revision pulse + Next evaluation (two-up) */}
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/student/tasks"
                    className="motion-fade-up flex flex-col gap-3 rounded-[20px] border border-border-card bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-primary" />
                        <span className="text-[13px] font-bold text-text-body">
                            المراجعة
                        </span>
                    </div>
                    <div className="flex items-center justify-center">
                        <ProgressRing
                            value={dueTodayCount === 0 ? 0 : Math.max(1, dueTodayCount - overdueCount)}
                            max={Math.max(1, dueTodayCount)}
                            size="sm"
                            tone={overdueCount > 0 ? "danger" : dueTodayCount > 0 ? "warning" : "success"}
                            label={dueTodayCount}
                            sublabel={overdueCount > 0 ? `${overdueCount} متأخرة` : dueTodayCount > 0 ? "اليوم" : "تمت"}
                        />
                    </div>
                    <span className="text-center text-[11px] text-text-muted">
                        {dueTodayCount === 0 ? "لا توجد مراجعات" : "ابدأ المراجعة"}
                    </span>
                </Link>

                <Link
                    href={nextTest ? `/student/evaluations/${nextTest.id}` : "/student/evaluations"}
                    className="motion-fade-up flex flex-col gap-3 rounded-[20px] border border-border-card bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                    style={{ animationDelay: "60ms" }}
                >
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-secondary" />
                        <span className="text-[13px] font-bold text-text-body">
                            الاختبار القادم
                        </span>
                    </div>
                    {nextTest ? (
                        <div className="flex flex-col items-center justify-center gap-1 flex-1">
                            <Countdown target={nextTest.scheduled_date} />
                            <span className="text-center text-[12px] font-bold text-text-title truncate w-full">
                                {nextTest.title || nextTest.surah_range}
                            </span>
                            {nextTest.surah_range && nextTest.title ? (
                                <span className="text-center text-[10px] text-text-muted truncate w-full">
                                    {nextTest.surah_range}
                                </span>
                            ) : null}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-1 flex-1">
                            <Sparkles className="h-6 w-6 text-text-muted" />
                            <span className="text-center text-[11px] text-text-muted">
                                لا اختبارات قريبة
                            </span>
                        </div>
                    )}
                </Link>
            </div>

            {/* 6. Week ring + day dots */}
            <div className="rounded-[20px] border border-border-card bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <h3 className="text-[15px] font-bold text-text-body">
                            أسبوعك
                        </h3>
                    </div>
                    <span className="text-[12px] text-text-muted">
                        {weeklyPlan?.total_achieved ?? 0} / {weeklyPlan?.total_required ?? 0} صفحة
                    </span>
                </div>
                <div className="flex items-center gap-5">
                    <ProgressRing
                        value={weeklyCompletion}
                        size="sm"
                        tone={
                            weeklyCompletion >= 80
                                ? "success"
                                : weeklyCompletion >= 50
                                  ? "primary"
                                  : weeklyCompletion > 0
                                    ? "warning"
                                    : "danger"
                        }
                        sublabel="الإنجاز"
                    />
                    <div className="flex flex-1 items-start justify-between">
                        {(() => {
                            const dayOrder: Array<{ key: string; label: string }> = [
                                { key: "sat", label: "س" },
                                { key: "sun", label: "أ" },
                                { key: "mon", label: "ث" },
                                { key: "tue", label: "ر" },
                                { key: "wed", label: "خ" },
                                { key: "thu", label: "ج" },
                            ];
                            const todayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
                            const todayKey = todayMap[new Date().getDay()];
                            const recordByDay = new Map(
                                (weeklyPlan?.records ?? []).map((r) => [r.day, r])
                            );
                            return dayOrder.map(({ key, label }) => {
                                const rec = recordByDay.get(key);
                                const done = rec?.attendance === "present";
                                const late = rec?.attendance === "late";
                                const absent = rec?.attendance === "absent";
                                const isToday = key === todayKey;
                                const bg = done
                                    ? "bg-success-text"
                                    : late
                                      ? "bg-attend-late-text"
                                      : absent
                                        ? "bg-attend-absent-text"
                                        : isToday
                                          ? "bg-secondary"
                                          : "bg-border-card";
                                const fg = done || late || absent || isToday
                                    ? "text-white"
                                    : "text-text-muted";
                                return (
                                    <div key={key} className="text-center">
                                        <div
                                            className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold ${bg} ${fg} ${isToday ? "ring-4 ring-secondary/30" : ""}`}
                                            title={rec?.attendance ?? "قادم"}
                                        >
                                            {done ? "✓" : late ? "!" : absent ? "×" : label}
                                        </div>
                                        <div className="text-[9px] text-text-muted">{label}</div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>

            {/* 7. Stats grid */}
            <div className="grid grid-cols-3 gap-3">
                <StatTile
                    icon={<BookOpen className="h-5 w-5 text-primary" />}
                    tileBg="blue"
                    label="الأجزاء"
                    value={memorizedParts}
                />
                <StatTile
                    icon={<Calendar className="h-5 w-5 text-primary" />}
                    tileBg="blue"
                    label="حضور"
                    value={studyDays}
                />
                <StatTile
                    icon={<Flame className="h-5 w-5 text-danger-text" />}
                    tileBg="red"
                    label="غياب"
                    value={absentDays}
                />
            </div>

            {/* 8. Achievement badges */}
            {streak >= 7 && (
                <div className="space-y-2">
                    {streak >= 30 && (
                        <div className="flex items-center gap-3 rounded-[14px] bg-tile-yellow border border-secondary/30 px-4 py-3">
                            <Trophy className="h-5 w-5 shrink-0 text-secondary" />
                            <span className="text-[13px] font-bold text-text-body">
                                نبارك الإنجاز! {streak} يوم حضور متواصل
                            </span>
                        </div>
                    )}
                    {memorizedParts >= 7 && (
                        <div className="flex items-center gap-3 rounded-[14px] bg-tile-green border border-emerald-200 px-4 py-3">
                            <Award className="h-5 w-5 shrink-0 text-emerald-600" />
                            <span className="text-[13px] font-bold text-text-body">
                                نبارك إتمام {memorizedParts} أجزاء من القرآن الكريم
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* 9. Goal progress */}
            <div className="rounded-[24px] border border-border-card bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        <h3 className="text-[18px] font-bold text-text-body">
                            الهدف الحالي
                        </h3>
                    </div>
                    <span className="text-[14px] font-bold text-primary">
                        {goalProgress}%
                    </span>
                </div>
                <p className="mb-3 text-[16px] font-bold text-text-body">
                    {currentGoal}
                </p>
                <ProgressBar value={goalProgress} size="md" />
            </div>

            {/* 10. Today's Evaluation details */}
            <div className="rounded-[24px] border border-border-card bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <Star className="h-5 w-5 text-secondary fill-secondary" />
                    <h3 className="text-[16px] font-bold text-text-body">تقييم اليوم</h3>
                </div>
                {todayRecord ? (
                    <div className="space-y-3">
                        {[
                            {
                                label: "الحضور",
                                value:
                                    todayRecord.attendance === "present"
                                        ? "حاضر"
                                        : todayRecord.attendance === "late"
                                          ? "متأخر"
                                          : todayRecord.attendance === "absent"
                                            ? "غائب"
                                            : "مستأذن",
                                stars:
                                    todayRecord.attendance === "present"
                                        ? 3
                                        : todayRecord.attendance === "late"
                                          ? 2
                                          : 0,
                                color:
                                    todayRecord.attendance === "present"
                                        ? "text-emerald-600"
                                        : todayRecord.attendance === "late"
                                          ? "text-amber-600"
                                          : "text-rose-600",
                            },
                            {
                                label: "الحفظ",
                                value: QUALITY_LABELS[todayRecord.quality] || "-",
                                stars: QUALITY_STARS[todayRecord.quality] || 0,
                                color: "text-primary",
                            },
                            {
                                label: "المنجز",
                                value:
                                    todayRecord.achieved_verses > 0
                                        ? `${todayRecord.achieved_verses} صفحات`
                                        : "-",
                                stars:
                                    todayRecord.achieved_verses >= 5
                                        ? 3
                                        : todayRecord.achieved_verses >= 3
                                          ? 2
                                          : todayRecord.achieved_verses >= 1
                                            ? 1
                                            : 0,
                                color: "text-primary",
                            },
                        ].map(({ label, value, stars, color }) => (
                            <div key={label} className="flex items-center justify-between">
                                <span className="text-[13px] text-text-muted font-medium">
                                    {label}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={"text-[13px] font-bold " + color}>
                                        {value}
                                    </span>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3].map((s) => (
                                            <Star
                                                key={s}
                                                className={
                                                    "h-3.5 w-3.5 " +
                                                    (s <= stars
                                                        ? "fill-secondary text-secondary"
                                                        : "text-border-subtle")
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[13px] text-text-muted text-center py-4">
                        لا يوجد تقييم لليوم بعد
                    </p>
                )}
            </div>

            {/* 11. Weekly plan table */}
            <div className="rounded-[24px] border border-border-card bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <h3 className="text-[18px] font-bold text-text-body">
                            الخطة الأسبوعية الحالية
                        </h3>
                    </div>
                    <Link
                        href="/student/plan"
                        className="text-[12px] font-bold text-primary hover:underline"
                    >
                        التفاصيل
                    </Link>
                </div>
                {planRows.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead>
                                <tr className="border-b border-border-card text-[12px] font-bold text-text-muted">
                                    <th className="pb-3 pe-2">اليوم</th>
                                    <th className="pb-3">الحضور</th>
                                    <th className="pb-3">المطلوب</th>
                                    <th className="pb-3">المنجز</th>
                                    <th className="pb-3">التقييم</th>
                                    <th className="pb-3 ps-2">النتيجة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-card">
                                {planRows.map((row, idx) => (
                                    <tr key={idx} className="text-[14px]">
                                        <td className="py-4 pe-2 font-bold text-text-body">
                                            {row.day}
                                        </td>
                                        <td className="py-4">
                                            <AttendancePill value={row.attendance} />
                                        </td>
                                        <td className="py-4 text-text-body">{row.required}</td>
                                        <td className="py-4 text-text-body">{row.achieved}</td>
                                        <td className="py-4">
                                            <RatingText value={row.evaluation} />
                                        </td>
                                        <td className="py-4 ps-2">
                                            <ResultPill value={row.result} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-[13px] text-text-muted text-center py-6">
                        لا توجد خطة أسبوعية حالياً
                    </p>
                )}
            </div>

            {/* 12. Verse of the day */}
            <div className="relative overflow-hidden rounded-[24px] border border-border-card bg-white p-6 shadow-sm">
                <Pattern kind="star8" color="#eabd5b" opacity={0.12} size={80} />
                <div className="relative">
                    <div className="mb-2 text-[11px] font-bold tracking-[1px] text-secondary">
                        آية اليوم
                    </div>
                    <p className="mb-2 text-[22px] font-semibold leading-[1.9] text-text-title">
                        وَقُل رَّبِّ زِدْنِي عِلْمًا
                    </p>
                    <p className="text-[11px] text-text-muted">طه · ١١٤</p>
                </div>
            </div>

            {/* 12b. Badges derived from stats + weekly summary */}
            <BadgeStrip
                inputs={{
                    streak,
                    memorizedParts,
                    weeklyCompletionRate: weeklyCompletion,
                    isPerfectWeek: isPerfectAttendance(weeklyPlan),
                    goalProgress,
                }}
            />

            {/* 13. History list */}
            <div className="rounded-[24px] border border-border-card bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    <h3 className="text-[18px] font-bold text-text-body">
                        آخر الإنجازات
                    </h3>
                </div>
                {historyRows.length > 0 ? (
                    <div className="space-y-4">
                        {historyRows.slice(0, 5).map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between rounded-[16px] border border-border-card p-4"
                            >
                                <div className="flex flex-col gap-1">
                                    <span className="text-[16px] font-bold text-text-body">
                                        {item.title}
                                    </span>
                                    <span className="text-[12px] text-text-muted">
                                        {item.date}
                                    </span>
                                </div>
                                <RatingPill value={item.rating ?? "none"} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[13px] text-text-muted text-center py-6">
                        لا توجد إنجازات مسجلة بعد
                    </p>
                )}
            </div>
        </div>
    );
}
