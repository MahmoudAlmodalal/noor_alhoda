import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressBarProps {
    value: number;
    max?: number;
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
    label?: string;
    className?: string;
}

const HEIGHTS: Record<NonNullable<ProgressBarProps["size"]>, string> = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
};

export function ProgressBar({
    value,
    max = 100,
    size = "md",
    showLabel,
    label,
    className,
}: ProgressBarProps) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div className={className}>
            {showLabel && (
                <div className="mb-1.5 flex items-center justify-between text-[12px] text-text-muted">
                    {label && <span>{label}</span>}
                    <span className="font-bold text-primary">{Math.round(pct)}%</span>
                </div>
            )}
            <div
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                className={cn(
                    "w-full overflow-hidden rounded-full bg-border-card",
                    HEIGHTS[size]
                )}
            >
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
