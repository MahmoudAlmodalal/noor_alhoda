"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
    value: T;
    label: string;
    icon?: React.ReactNode;
}

export interface SegmentedProps<T extends string> {
    options: SegmentedOption<T>[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
    size?: "sm" | "md";
}

export function Segmented<T extends string>({
    options,
    value,
    onChange,
    className,
    size = "md",
}: SegmentedProps<T>) {
    const sizes = {
        sm: "text-[12px] px-3 py-1.5",
        md: "text-[13px] px-3.5 py-2",
    };
    return (
        <div
            className={cn(
                "inline-flex gap-0.5 rounded-[10px] bg-border-card p-1",
                className
            )}
            role="tablist"
        >
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-[6px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                            sizes[size],
                            active
                                ? "bg-white text-primary shadow-xs"
                                : "bg-transparent text-text-muted hover:text-text-body"
                        )}
                    >
                        {o.icon}
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
