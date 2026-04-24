"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ClipboardIllustration } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Countdown } from "@/components/ui/Countdown";
import { formatDualDate } from "@/lib/dates/hijri";
import { parseSurahRange } from "@/lib/quran/surahRange";
import { cn } from "@/lib/utils";
import type { EvaluationRecord } from "@/hooks/queries";
import type { TodayTasks } from "@/types/api";
import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    ChevronLeft,
    Clock,
    GraduationCap,
    Sparkles,
    XCircle,
} from "lucide-react";

const STATUS_META: Record<
    string,
    {
        label: string;
        bg: string;
        ring: string;
        Icon: React.ElementType;
    }
> = {
    scheduled: {
        label: "مجدول",
        bg: "bg-attend-upcoming-bg text-attend-upcoming-text",
        ring: "border-border-card",
        Icon: Clock,
    },
    passed: {
        label: "ناجح",
        bg: "bg-attend-present-bg text-attend-present-text",
        ring: "border-attend-present-text/30",
        Icon: CheckCircle2,
    },
    failed: {
        label: "راسب",
        bg: "bg-attend-absent-bg text-attend-absent-text",
        ring: "border-attend-absent-text/30",
        Icon: XCircle,
    },
    missed: {
        label: "متغيّب",
        bg: "bg-attend-late-bg text-attend-late-text",
        ring: "border-attend-late-text/30",
        Icon: XCircle,
    },
};

export default function StudentEvaluationDetailPage() {
    const params = useParams<{ id: string }>();
    const evaluationId = typeof params?.id === "string" ? params.id : "";
    const { user } = useAuth();
    const studentProfileId = user?.student_profile?.id;

    const { data: evaluations, isLoading } = useQuery<EvaluationRecord[]>(
        studentProfileId ? "evaluations" : null,
        studentProfileId ? { student_id: studentProfileId } : undefined,
    );

    const { data: tasks } = useQuery<TodayTasks>(
        studentProfileId ? "tasks_today" : null,
        studentProfileId ? { student_id: studentProfileId } : undefined,
    );

    const evaluation = useMemo(
        () => (evaluations ?? []).find((e) => e.id === evaluationId),
        [evaluations, evaluationId],
    );

    const readiness = useMemo(() => {
        if (!evaluation || !tasks) return null;
        const names = parseSurahRange(evaluation.surah_range);
        if (names.length === 0) return null;
        const overdueSet = new Set(
            (tasks.reviews ?? [])
                .filter((r) => r.overdue_days > 0)
                .map((r) => r.surah_name),
        );
        const dueSet = new Set(
            (tasks.reviews ?? []).map((r) => r.surah_name),
        );
        const breakdown = names.map((name) => {
            if (overdueSet.has(name)) return { name, state: "overdue" as const };
            if (dueSet.has(name)) return { name, state: "due" as const };
            return { name, state: "ready" as const };
        });
        const ready = breakdown.filter((b) => b.state === "ready").length;
        const pct = Math.round((ready / names.length) * 100);
        return { breakdown, pct };
    }, [evaluation, tasks]);

    if (isLoading && !evaluation) {
        return (
            <div className="mx-auto max-w-md p-4 space-y-4" dir="rtl">
                <Skeleton className="h-8 w-40" rounded="md" />
                <Skeleton className="h-40 w-full" rounded="xl" />
                <Skeleton className="h-32 w-full" rounded="xl" />
            </div>
        );
    }

    if (!evaluation) {
        return (
            <div className="mx-auto max-w-md p-4" dir="rtl">
                <EmptyState
                    title="لم نجد الاختبار"
                    description="ربما تم حذفه، أو رابط الصفحة غير صحيح."
                    illustration={<ClipboardIllustration size={80} />}
                    tone="soft"
                    action={
                        <Link
                            href="/student/evaluations"
                            className="inline-flex items-center gap-2 rounded-[12px] bg-primary text-white px-4 py-2 text-[13px] font-bold hover:bg-primary/90 transition-colors"
                        >
                            <ArrowRight className="h-4 w-4" />
                            العودة للاختبارات
                        </Link>
                    }
                />
            </div>
        );
    }

    const scheduledDate = new Date(evaluation.scheduled_date);
    const dual = formatDualDate(scheduledDate);
    const meta = STATUS_META[evaluation.status] ?? STATUS_META.scheduled;
    const isPast = evaluation.status !== "scheduled";
    const questionsCount = 0; // Groundwork: no endpoint yet. Will be wired later.

    return (
        <div className="mx-auto max-w-md space-y-5 pb-24 px-1" dir="rtl">
            <Link
                href="/student/evaluations"
                className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text-body transition-colors"
            >
                <ChevronLeft className="h-4 w-4 rotate-180" />
                <ArrowRight className="h-3 w-3" />
                <span>الاختبارات</span>
            </Link>

            {/* Hero */}
            <div
                className={cn(
                    "motion-fade-up rounded-[24px] border bg-white p-5 shadow-sm",
                    meta.ring,
                )}
            >
                <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        <span className="text-[12px] font-bold text-text-muted">
                            اختبار
                        </span>
                    </div>
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1 text-[12px] font-bold",
                            meta.bg,
                        )}
                    >
                        <meta.Icon className="h-3.5 w-3.5" />
                        {meta.label}
                    </span>
                </div>

                <h1 className="text-[22px] font-bold text-text-title mb-2">
                    {evaluation.title}
                </h1>

                {evaluation.surah_range ? (
                    <div className="mb-3 inline-flex items-center gap-2 rounded-[10px] bg-tile-blue px-3 py-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="text-[13px] font-bold text-primary">
                            {evaluation.surah_range}
                        </span>
                    </div>
                ) : null}

                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-text-body">
                            {dual.gregorian}
                        </span>
                        <span className="text-[11px] text-text-muted">
                            {dual.hijri}
                        </span>
                    </div>
                    {!isPast ? (
                        <Countdown
                            target={evaluation.scheduled_date}
                            compact={false}
                        />
                    ) : null}
                </div>
            </div>

            {/* Preparation card — only for scheduled */}
            {!isPast && readiness ? (
                <div className="motion-fade-up rounded-[20px] border border-border-card bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-secondary" />
                        <h3 className="text-[14px] font-bold text-text-body">
                            جاهزيتك للاختبار
                        </h3>
                    </div>
                    <div className="flex items-center gap-5">
                        <ProgressRing
                            value={readiness.pct}
                            size="sm"
                            tone={
                                readiness.pct >= 80
                                    ? "success"
                                    : readiness.pct >= 50
                                      ? "primary"
                                      : "warning"
                            }
                            sublabel="جاهز"
                        />
                        <div className="flex-1 flex flex-col gap-1.5">
                            {readiness.breakdown.map((b) => (
                                <div
                                    key={b.name}
                                    className="flex items-center justify-between"
                                >
                                    <span className="text-[12px] text-text-body truncate">
                                        {b.name}
                                    </span>
                                    <span
                                        className={cn(
                                            "shrink-0 rounded-[6px] px-1.5 py-0.5 text-[10px] font-bold",
                                            b.state === "ready" &&
                                                "bg-attend-present-bg text-attend-present-text",
                                            b.state === "due" &&
                                                "bg-attend-late-bg text-attend-late-text",
                                            b.state === "overdue" &&
                                                "bg-attend-absent-bg text-attend-absent-text",
                                        )}
                                    >
                                        {b.state === "ready"
                                            ? "جاهز"
                                            : b.state === "due"
                                              ? "يحتاج مراجعة"
                                              : "متأخر"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <Link
                        href="/student/tasks"
                        className="mt-4 flex items-center justify-center gap-2 rounded-[12px] bg-primary text-white py-2.5 text-[13px] font-bold hover:bg-primary/90 transition-colors"
                    >
                        <BookOpen className="h-4 w-4" />
                        ابدأ المراجعة
                    </Link>
                </div>
            ) : null}

            {/* Result card — for passed/failed/missed */}
            {isPast ? (
                <div
                    className={cn(
                        "motion-fade-up rounded-[20px] border p-5 shadow-sm",
                        meta.ring,
                        evaluation.status === "passed"
                            ? "bg-attend-present-bg/30"
                            : "bg-attend-absent-bg/20",
                    )}
                >
                    <div className="mb-3 flex items-center gap-2">
                        <meta.Icon
                            className={cn(
                                "h-5 w-5",
                                evaluation.status === "passed"
                                    ? "text-attend-present-text"
                                    : "text-attend-absent-text",
                            )}
                        />
                        <h3 className="text-[14px] font-bold text-text-body">
                            النتيجة
                        </h3>
                    </div>
                    <p
                        className={cn(
                            "text-[18px] font-bold mb-2",
                            evaluation.status === "passed"
                                ? "text-attend-present-text"
                                : "text-attend-absent-text",
                        )}
                    >
                        {meta.label}
                    </p>
                    {evaluation.result_note ? (
                        <p className="text-[13px] text-text-body leading-[1.9] border-t border-border-card pt-3">
                            {evaluation.result_note}
                        </p>
                    ) : (
                        <p className="text-[12px] text-text-muted">
                            لا توجد ملاحظة من المعلم.
                        </p>
                    )}
                    {evaluation.status === "failed" ? (
                        <Link
                            href="/student/tasks"
                            className="mt-4 flex items-center justify-center gap-2 rounded-[12px] bg-attend-absent-text text-white py-2.5 text-[13px] font-bold hover:opacity-90 transition-opacity"
                        >
                            <BookOpen className="h-4 w-4" />
                            مراجعة السور من هذا الاختبار
                        </Link>
                    ) : null}
                </div>
            ) : null}

            {/* Interactive quiz button — groundwork (disabled) */}
            {questionsCount > 0 ? (
                <button
                    type="button"
                    disabled
                    className="w-full flex items-center justify-center gap-2 rounded-[14px] border border-dashed border-border-subtle bg-surface-subtle py-4 text-[13px] font-bold text-text-muted cursor-not-allowed"
                >
                    <GraduationCap className="h-4 w-4" />
                    ابدأ الاختبار — سيتوفر قريباً
                </button>
            ) : null}
        </div>
    );
}
