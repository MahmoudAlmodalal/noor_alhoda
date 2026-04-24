import type { HistoryEntry, WeeklySummary } from "@/types/api";

export type AttendanceState =
    | "present"
    | "late"
    | "absent"
    | "excused"
    | "upcoming";

/**
 * Count consecutive attended days (present OR late) ending at "today" for
 * the current week. Stops at the first absent or upcoming-but-past day.
 * Does not look at prior weeks — call sites that need multi-week streaks
 * should compose this with prior summaries.
 */
export function computeCurrentStreak(summary: WeeklySummary | null | undefined): number {
    if (!summary?.records || summary.records.length === 0) return 0;

    const DAY_ORDER = ["sat", "sun", "mon", "tue", "wed", "thu"] as const;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);

    const byDay = new Map<string, HistoryEntry>(
        summary.records.map((r) => [(r.day as string) ?? "", r]),
    );

    let streak = 0;
    // Walk Sat → Thu up to and including today.
    for (const key of DAY_ORDER) {
        const rec = byDay.get(key);
        if (!rec) break;
        // Skip days in the future.
        if (rec.date > todayIso) break;
        const attendance = rec.attendance as AttendanceState;
        if (attendance === "present" || attendance === "late") {
            streak += 1;
        } else {
            // Break on absent or excused. Don't break on the today-but-upcoming
            // record; treat that as "not yet counted".
            if (attendance === "upcoming") break;
            streak = 0;
        }
    }

    return streak;
}

/** True when every non-upcoming day in the week has attendance=present. */
export function isPerfectAttendance(
    summary: WeeklySummary | null | undefined,
): boolean {
    if (!summary?.records || summary.records.length === 0) return false;
    let counted = 0;
    for (const r of summary.records) {
        const a = r.attendance as AttendanceState;
        if (a === "upcoming") continue;
        counted += 1;
        if (a !== "present") return false;
    }
    return counted > 0;
}
