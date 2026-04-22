import * as React from "react";
import { cn } from "@/lib/utils";

export type AttendanceValue =
    | "present"
    | "late"
    | "absent"
    | "excused"
    | "upcoming";

const ATTENDANCE_META: Record<
    AttendanceValue,
    { label: string; className: string }
> = {
    present: {
        label: "حاضر",
        className: "bg-attend-present-bg text-attend-present-text",
    },
    late: {
        label: "متأخر",
        className: "bg-attend-late-bg text-attend-late-text",
    },
    absent: {
        label: "غائب",
        className: "bg-attend-absent-bg text-attend-absent-text",
    },
    excused: {
        label: "مستأذن",
        className: "bg-attend-excused-bg text-attend-excused-text",
    },
    upcoming: {
        label: "قادم",
        className: "bg-attend-upcoming-bg text-attend-upcoming-text",
    },
};

export function AttendancePill({
    value,
    className,
}: {
    value: AttendanceValue;
    className?: string;
}) {
    const meta = ATTENDANCE_META[value] ?? ATTENDANCE_META.upcoming;
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

export { ATTENDANCE_META };
