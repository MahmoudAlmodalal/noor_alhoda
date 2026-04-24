"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useMutation } from "@/hooks/useMutation";
import { cn } from "@/lib/utils";
import { QualitySelect, type ReviewQuality } from "./QualitySelect";

interface Props {
    studentId: string;
    surahName: string;
    priority?: "overdue" | "today" | "upcoming";
    nextDueLabel?: string;
    onComplete?: () => void;
    /**
     * Render as compact inline button (old behaviour) instead of the
     * quality-picker card. Used for tight lists and the dashboard pulse.
     */
    compact?: boolean;
}

const PRIORITY_STYLES: Record<NonNullable<Props["priority"]>, { badge: string; ring: string }> = {
    overdue: {
        badge: "bg-attend-absent-bg text-attend-absent-text",
        ring: "border-attend-absent-text/20",
    },
    today: {
        badge: "bg-attend-late-bg text-attend-late-text",
        ring: "border-attend-late-text/20",
    },
    upcoming: {
        badge: "bg-attend-upcoming-bg text-attend-upcoming-text",
        ring: "border-border-card",
    },
};

const PRIORITY_LABEL: Record<NonNullable<Props["priority"]>, string> = {
    overdue: "متأخرة",
    today: "لليوم",
    upcoming: "قادمة",
};

export function ReviewCompleteButton({
    studentId,
    surahName,
    priority,
    nextDueLabel,
    onComplete,
    compact = false,
}: Props) {
    const { mutate, isSubmitting } = useMutation("review_record", "create");
    const [quality, setQuality] = useState<ReviewQuality>("good");
    const [note, setNote] = useState("");
    const [showNote, setShowNote] = useState(false);
    const [done, setDone] = useState(false);

    async function handleSubmit(qualityOverride?: ReviewQuality) {
        const chosen = qualityOverride ?? quality;
        const result = await mutate(
            {
                student_id: studentId,
                surah_name: surahName,
                reviewed_date: new Date().toISOString().slice(0, 10),
                quality: chosen,
                note: chosen === "weak" ? note : "",
            },
            { successMessage: "تمت المراجعة بنجاح" },
        );
        if (result) {
            setDone(true);
            onComplete?.();
        }
    }

    if (compact) {
        return (
            <button
                onClick={() => handleSubmit("acceptable")}
                disabled={isSubmitting || done}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-attend-present-bg px-3 py-1.5 text-[13px] font-bold text-attend-present-text transition-opacity hover:opacity-80 disabled:opacity-50"
            >
                {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Check className="h-4 w-4" />
                )}
                <span>{done ? "تمت المراجعة" : "تمت"}</span>
            </button>
        );
    }

    const pstyle = priority ? PRIORITY_STYLES[priority] : null;

    return (
        <div
            className={cn(
                "motion-fade-up rounded-[16px] border bg-white p-3 shadow-[var(--shadow-xs)]",
                pstyle?.ring ?? "border-border-card",
            )}
        >
            <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[14px] font-bold text-text-title truncate">
                    {surahName}
                </span>
                {priority ? (
                    <span
                        className={cn(
                            "shrink-0 rounded-[8px] px-2 py-0.5 text-[11px] font-bold",
                            pstyle!.badge,
                        )}
                    >
                        {PRIORITY_LABEL[priority]}
                    </span>
                ) : null}
            </div>

            {nextDueLabel ? (
                <p className="mb-2 text-[11px] text-text-muted">{nextDueLabel}</p>
            ) : null}

            <QualitySelect
                value={quality}
                onChange={setQuality}
                disabled={isSubmitting || done}
                size="sm"
                className="mb-2"
            />

            {quality === "weak" ? (
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="ملاحظة (آيات تحتاج تركيزاً، إلخ)"
                    rows={2}
                    disabled={isSubmitting || done}
                    className="mb-2 w-full rounded-[10px] border border-border-subtle bg-surface-subtle p-2 text-[12px] text-text-body placeholder:text-text-placeholder focus:border-primary focus:outline-none resize-none"
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setShowNote((s) => !s)}
                    className="mb-2 inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-body"
                >
                    <ChevronDown
                        className={cn(
                            "h-3 w-3 transition-transform",
                            showNote && "rotate-180",
                        )}
                    />
                    <span>ملاحظة اختيارية</span>
                </button>
            )}

            {showNote && quality !== "weak" ? (
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="ملاحظة اختيارية"
                    rows={2}
                    disabled={isSubmitting || done}
                    className="mb-2 w-full rounded-[10px] border border-border-subtle bg-surface-subtle p-2 text-[12px] text-text-body placeholder:text-text-placeholder focus:border-primary focus:outline-none resize-none"
                />
            ) : null}

            <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSubmitting || done}
                className={cn(
                    "w-full inline-flex items-center justify-center gap-2 h-10 rounded-[12px] font-bold text-[13px] transition-colors",
                    done
                        ? "bg-attend-present-bg text-attend-present-text"
                        : "bg-primary text-white hover:bg-primary/90",
                    (isSubmitting || done) && "opacity-80 cursor-not-allowed",
                )}
            >
                {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Check className="h-4 w-4" />
                )}
                <span>{done ? "تمت المراجعة" : "تسجيل المراجعة"}</span>
            </button>
        </div>
    );
}
