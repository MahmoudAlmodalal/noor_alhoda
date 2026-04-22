import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
    padding?: "sm" | "md" | "lg" | "none";
    radius?: "md" | "lg" | "xl";
}

const PADDING: Record<NonNullable<SectionCardProps["padding"]>, string> = {
    none: "p-0",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
};

const RADIUS: Record<NonNullable<SectionCardProps["radius"]>, string> = {
    md: "rounded-[16px]",
    lg: "rounded-[20px]",
    xl: "rounded-[24px]",
};

export function SectionCard({
    padding = "lg",
    radius = "xl",
    className,
    children,
    ...rest
}: SectionCardProps) {
    return (
        <div
            className={cn(
                "border border-border-card bg-white shadow-sm",
                PADDING[padding],
                RADIUS[radius],
                className
            )}
            {...rest}
        >
            {children}
        </div>
    );
}
