"use client";

import { cn } from "@/lib/utils";

export type ReviewQuality = "excellent" | "good" | "acceptable" | "weak";

type QualitySelectProps = {
    value: ReviewQuality | null;
    onChange: (q: ReviewQuality) => void;
    disabled?: boolean;
    className?: string;
    size?: "sm" | "md";
};

const QUALITIES: Array<{
    value: ReviewQuality;
    label: string;
    selectedClass: string;
}> = [
    {
        value: "excellent",
        label: "ممتاز",
        selectedClass:
            "bg-attend-present-bg text-attend-present-text border-attend-present-text/30",
    },
    {
        value: "good",
        label: "جيد جداً",
        selectedClass:
            "bg-[#dbeafe] text-[#1447e6] border-[#1447e6]/30",
    },
    {
        value: "acceptable",
        label: "جيد",
        selectedClass:
            "bg-[#ffedd4] text-[#ca3500] border-[#ca3500]/30",
    },
    {
        value: "weak",
        label: "ضعيف",
        selectedClass:
            "bg-attend-absent-bg text-attend-absent-text border-attend-absent-text/30",
    },
];

export function QualitySelect({
    value,
    onChange,
    disabled,
    className,
    size = "md",
}: QualitySelectProps) {
    const height = size === "sm" ? "h-8 text-[12px]" : "h-10 text-[13px]";
    return (
        <div
            role="radiogroup"
            aria-label="جودة المراجعة"
            className={cn(
                "grid grid-cols-4 gap-1.5 rounded-[12px] border border-border-card bg-surface-subtle p-1",
                className,
            )}
        >
            {QUALITIES.map((q) => {
                const active = value === q.value;
                return (
                    <button
                        key={q.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={disabled}
                        onClick={() => onChange(q.value)}
                        className={cn(
                            "flex items-center justify-center rounded-[10px] font-bold transition-all border",
                            height,
                            active
                                ? q.selectedClass
                                : "bg-transparent text-text-muted border-transparent hover:text-text-body",
                            disabled && "opacity-50 cursor-not-allowed",
                        )}
                    >
                        {q.label}
                    </button>
                );
            })}
        </div>
    );
}
