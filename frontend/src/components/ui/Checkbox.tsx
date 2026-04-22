"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: React.ReactNode;
    disabled?: boolean;
    className?: string;
    id?: string;
}

export function Checkbox({
    checked,
    onChange,
    label,
    disabled,
    className,
    id,
}: CheckboxProps) {
    return (
        <label
            htmlFor={id}
            className={cn(
                "inline-flex cursor-pointer items-center gap-2.5",
                disabled && "cursor-not-allowed opacity-50",
                className
            )}
        >
            <button
                id={id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={cn(
                    "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                    checked
                        ? "border-primary bg-primary"
                        : "border-border-subtle bg-white"
                )}
            >
                {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
            </button>
            {label && (
                <span className="text-[14px] text-text-body">{label}</span>
            )}
        </label>
    );
}
