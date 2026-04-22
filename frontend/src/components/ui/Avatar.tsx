import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps {
    name?: string;
    size?: number;
    src?: string;
    className?: string;
}

function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] ?? "")
        .join("");
}

export function Avatar({
    name = "",
    size = 40,
    src,
    className,
}: AvatarProps) {
    const initials = getInitials(name);
    return (
        <div
            style={{
                width: size,
                height: size,
                fontSize: Math.round(size * 0.36),
            }}
            className={cn(
                "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-[#083d73] font-bold text-white",
                className
            )}
        >
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={name} className="h-full w-full object-cover" />
            ) : (
                initials || "?"
            )}
        </div>
    );
}
