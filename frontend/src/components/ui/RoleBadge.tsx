import * as React from "react";
import { cn } from "@/lib/utils";

export type RoleValue = "admin" | "teacher" | "student" | "parent";

const ROLE_META: Record<RoleValue, { label: string; className: string }> = {
    admin: {
        label: "المدير",
        className: "bg-role-admin-bg text-role-admin-text",
    },
    teacher: {
        label: "المحفظ",
        className: "bg-role-teacher-bg text-role-teacher-text",
    },
    student: {
        label: "الطالب",
        className: "bg-role-student-bg text-role-student-text",
    },
    parent: {
        label: "ولي الأمر",
        className: "bg-role-parent-bg text-role-parent-text",
    },
};

export function RoleBadge({
    role,
    className,
}: {
    role: RoleValue;
    className?: string;
}) {
    const meta = ROLE_META[role];
    if (!meta) return null;
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
                meta.className,
                className
            )}
        >
            {meta.label}
        </span>
    );
}

export { ROLE_META };
