import * as React from "react";
import { cn } from "@/lib/utils";

export type PatternKind = "star8" | "dots" | "arabesque" | "grid";

export interface PatternProps {
    kind?: PatternKind;
    color?: string;
    opacity?: number;
    size?: number;
    className?: string;
}

function buildSvg(
    kind: PatternKind,
    color: string,
    opacity: number,
    size: number
): string {
    const c = encodeURIComponent(color);
    const o = opacity.toString();
    switch (kind) {
        case "star8":
            return `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 40 40'><g fill='none' stroke='${c}' stroke-width='1' opacity='${o}'><path d='M20 4l4 12h12l-10 8 4 12-10-8-10 8 4-12-10-8h12z'/></g></svg>`;
        case "arabesque":
            return `<svg xmlns='http://www.w3.org/2000/svg' width='${size * 2}' height='${size * 2}' viewBox='0 0 80 80'><g fill='none' stroke='${c}' stroke-width='1' opacity='${o}'><circle cx='0' cy='0' r='20'/><circle cx='40' cy='0' r='20'/><circle cx='80' cy='0' r='20'/><circle cx='0' cy='40' r='20'/><circle cx='40' cy='40' r='20'/><circle cx='80' cy='40' r='20'/><circle cx='0' cy='80' r='20'/><circle cx='40' cy='80' r='20'/><circle cx='80' cy='80' r='20'/><circle cx='20' cy='20' r='20'/><circle cx='60' cy='20' r='20'/><circle cx='20' cy='60' r='20'/><circle cx='60' cy='60' r='20'/></g></svg>`;
        case "grid":
            return `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 40 40'><path d='M40 0H0v40' fill='none' stroke='${c}' stroke-width='1' opacity='${o}'/></svg>`;
        case "dots":
        default:
            return `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 20 20'><circle cx='10' cy='10' r='1' fill='${c}' opacity='${o}'/></svg>`;
    }
}

export function Pattern({
    kind = "dots",
    color = "#eabd5b",
    opacity = 0.08,
    size = 40,
    className,
}: PatternProps) {
    const svg = buildSvg(kind, color, opacity, size).replace(/"/g, "'");
    return (
        <div
            aria-hidden
            className={cn("pointer-events-none absolute inset-0", className)}
            style={{
                backgroundImage: `url("data:image/svg+xml;utf8,${svg}")`,
            }}
        />
    );
}
