import * as React from "react";
import { cn } from "@/lib/utils";

export type ResultValue = "pass" | "fail" | "pending" | "none";

const RESULT_META: Record<ResultValue, { label: string; className: string }> = {
    pass: {
        label: "ناجح",
        className: "bg-result-pass-bg text-result-pass-text",
    },
    fail: {
        label: "راسب",
        className: "bg-result-fail-bg text-result-fail-text",
    },
    pending: {
        label: "معلّق",
        className: "bg-result-pending-bg text-result-pending-text",
    },
    none: {
        label: "—",
        className: "bg-attend-upcoming-bg text-attend-upcoming-text",
    },
};

export function ResultPill({
    value,
    className,
}: {
    value: ResultValue;
    className?: string;
}) {
    const meta = RESULT_META[value] ?? RESULT_META.none;
    return (
        <span
            className={cn(
                "inline-block rounded-[4px] px-2.5 py-1 text-[12px] font-bold",
                meta.className,
                className
            )}
        >
            {meta.label}
        </span>
    );
}

export { RESULT_META };
