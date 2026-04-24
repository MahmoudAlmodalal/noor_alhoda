"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@/hooks/useApi";
import { EvaluationListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ClipboardIllustration } from "@/components/ui/EmptyState";
import { Countdown } from "@/components/ui/Countdown";
import { formatDualDate } from "@/lib/dates/hijri";
import { cn } from "@/lib/utils";
import type { EvaluationRecord } from "@/hooks/queries";
import {
    ChevronLeft,
    GraduationCap,
    CheckCircle2,
    XCircle,
    Clock,
} from "lucide-react";

type Tab = "upcoming" | "passed" | "failed" | "all";

const TABS: Array<{ key: Tab; label: string }> = [
    { key: "upcoming", label: "قادمة" },
    { key: "passed", label: "ناجحة" },
    { key: "failed", label: "راسبة" },
    { key: "all", label: "الكل" },
];

const STATUS_STYLES: Record<
    string,
    { label: string; bg: string; icon: React.ElementType }
> = {
    scheduled: {
        label: "مجدول",
        bg: "bg-attend-upcoming-bg text-attend-upcoming-text",
        icon: Clock,
    },
    passed: {
        label: "ناجح",
        bg: "bg-attend-present-bg text-attend-present-text",
        icon: CheckCircle2,
    },
    failed: {
        label: "راسب",
        bg: "bg-attend-absent-bg text-attend-absent-text",
        icon: XCircle,
    },
    missed: {
        label: "متغيّب",
        bg: "bg-attend-late-bg text-attend-late-text",
        icon: XCircle,
    },
};

function StatusBadge({ status }: { status: string }) {
    const s = STATUS_STYLES[status] ?? STATUS_STYLES.scheduled;
    const Icon = s.icon;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-[8px] px-2 py-0.5 text-[11px] font-bold",
                s.bg,
            )}
        >
            <Icon className="h-3 w-3" />
            {s.label}
        </span>
    );
}

export default function StudentEvaluationsPage() {
    const { user } = useAuth();
    const studentProfileId = user?.student_profile?.id;
    const [tab, setTab] = useState<Tab>("upcoming");

    const { data: evaluations, isLoading } = useQuery<EvaluationRecord[]>(
        studentProfileId ? "evaluations" : null,
        studentProfileId ? { student_id: studentProfileId } : undefined,
    );

    const filtered = useMemo(() => {
        const list = evaluations ?? [];
        if (tab === "all") {
            return [...list].sort((a, b) =>
                b.scheduled_date.localeCompare(a.scheduled_date),
            );
        }
        if (tab === "upcoming") {
            return list
                .filter((e) => e.status === "scheduled")
                .sort((a, b) =>
                    a.scheduled_date.localeCompare(b.scheduled_date),
                );
        }
        return list
            .filter((e) => e.status === tab)
            .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
    }, [evaluations, tab]);

    const counts = useMemo(() => {
        const list = evaluations ?? [];
        return {
            upcoming: list.filter((e) => e.status === "scheduled").length,
            passed: list.filter((e) => e.status === "passed").length,
            failed: list.filter((e) => e.status === "failed").length,
            all: list.length,
        };
    }, [evaluations]);

    if (isLoading) {
        return (
            <div className="mx-auto max-w-md p-4" dir="rtl">
                <EvaluationListSkeleton />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-md space-y-5 pb-24 px-1" dir="rtl">
            <div className="flex items-center gap-2">
                <GraduationCap className="h-6 w-6 text-primary" />
                <h1 className="text-[20px] font-bold text-text-title">
                    الاختبارات
                </h1>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-[14px] border border-border-card bg-white p-1 shadow-sm">
                {TABS.map((t) => {
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={cn(
                                "flex-1 inline-flex items-center justify-center gap-1 rounded-[10px] px-2 py-2 text-[12px] font-bold transition-colors",
                                active
                                    ? "bg-primary text-white"
                                    : "text-text-muted hover:bg-surface-subtle hover:text-text-body",
                            )}
                        >
                            {t.label}
                            {counts[t.key] > 0 && (
                                <span
                                    className={cn(
                                        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px]",
                                        active
                                            ? "bg-white/20 text-white"
                                            : "bg-border-card text-text-muted",
                                    )}
                                >
                                    {counts[t.key]}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {filtered.length === 0 ? (
                <EmptyState
                    title={
                        tab === "upcoming"
                            ? "لا توجد اختبارات قادمة"
                            : tab === "passed"
                              ? "لا توجد اختبارات ناجحة بعد"
                              : tab === "failed"
                                ? "لا توجد اختبارات راسبة"
                                : "لا توجد اختبارات"
                    }
                    description={
                        tab === "upcoming"
                            ? "سيظهر الاختبار هنا عندما يقوم معلمك بجدولته."
                            : "ستظهر نتائج الاختبارات هنا بعد تسجيلها."
                    }
                    illustration={<ClipboardIllustration size={80} />}
                    tone="soft"
                />
            ) : (
                <ul className="space-y-3">
                    {filtered.map((ev) => {
                        const dual = formatDualDate(new Date(ev.scheduled_date));
                        return (
                            <li key={ev.id}>
                                <Link
                                    href={`/student/evaluations/${ev.id}`}
                                    className="motion-fade-up block rounded-[16px] border border-border-card bg-white p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                                >
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <h3 className="text-[15px] font-bold text-text-title flex-1 truncate">
                                            {ev.title}
                                        </h3>
                                        <StatusBadge status={ev.status} />
                                    </div>
                                    {ev.surah_range ? (
                                        <p className="mb-2 text-[12px] text-text-muted truncate">
                                            {ev.surah_range}
                                        </p>
                                    ) : null}
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-text-body">
                                                {dual.gregorian}
                                            </span>
                                            <span className="text-[10px] text-text-muted">
                                                {dual.hijri}
                                            </span>
                                        </div>
                                        {ev.status === "scheduled" ? (
                                            <Countdown
                                                target={ev.scheduled_date}
                                                compact
                                            />
                                        ) : (
                                            <ChevronLeft className="h-4 w-4 text-text-muted" />
                                        )}
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
