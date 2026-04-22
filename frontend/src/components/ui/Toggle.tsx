"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
}

export function Toggle({
    checked,
    onChange,
    label,
    disabled,
    className,
}: ToggleProps) {
    return (
        <label
            className={cn(
                "inline-flex cursor-pointer items-center gap-2.5",
                disabled && "cursor-not-allowed opacity-50",
                className
            )}
        >
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={cn(
                    "relative h-[22px] w-10 shrink-0 rounded-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                    checked ? "bg-primary" : "bg-border-subtle"
                )}
            >
                <span
                    className={cn(
                        "absolute top-0.5 block h-[18px] w-[18px] rounded-full bg-white shadow-xs transition-all",
                        checked ? "start-5" : "start-0.5"
                    )}
                />
            </button>
            {label && (
                <span className="text-[14px] text-text-body">{label}</span>
            )}
        </label>
    );
}
