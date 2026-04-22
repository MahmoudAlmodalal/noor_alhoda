import * as React from "react";
import { cn } from "@/lib/utils";

export type TileBg = "blue" | "yellow" | "red" | "green" | "amber" | string;

export interface StatTileProps {
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    tileBg?: TileBg;
    className?: string;
    labelClassName?: string;
    valueClassName?: string;
}

const TILE_BG_CLASSES: Record<string, string> = {
    blue: "bg-tile-blue",
    yellow: "bg-tile-yellow",
    red: "bg-tile-red",
    green: "bg-tile-green",
    amber: "bg-tile-amber",
};

function resolveTileBg(bg?: TileBg): string {
    if (!bg) return "bg-tile-blue";
    return TILE_BG_CLASSES[bg] ?? bg;
}

export function StatTile({
    label,
    value,
    icon,
    tileBg,
    className,
    labelClassName,
    valueClassName,
}: StatTileProps) {
    return (
        <div
            className={cn(
                "flex h-[180px] flex-col items-center justify-center rounded-[16px] border border-border-card bg-white px-4 shadow-xs",
                className
            )}
        >
            <div
                className={cn(
                    "mb-3 flex h-14 w-14 items-center justify-center rounded-[14px]",
                    resolveTileBg(tileBg)
                )}
            >
                {icon}
            </div>
            <span
                className={cn(
                    "mb-1 text-center text-[12px] font-bold leading-tight text-text-muted",
                    labelClassName
                )}
            >
                {label}
            </span>
            <span
                className={cn(
                    "text-[30px] font-bold leading-9 text-text-body",
                    valueClassName
                )}
            >
                {value}
            </span>
        </div>
    );
}
