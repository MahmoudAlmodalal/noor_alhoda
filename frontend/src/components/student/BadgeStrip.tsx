"use client";

import type { LucideIcon } from "lucide-react";
import {
    BookOpen,
    CheckCircle2,
    Flame,
    Star,
    Target,
    Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<
    "gold" | "blue" | "green" | "silver",
    { bg: string; text: string; border: string }
> = {
    gold: {
        bg: "bg-tile-yellow",
        text: "text-secondary",
        border: "border-secondary/30",
    },
    blue: {
        bg: "bg-tile-blue",
        text: "text-primary",
        border: "border-primary/30",
    },
    green: {
        bg: "bg-tile-green",
        text: "text-success-text",
        border: "border-success-text/30",
    },
    silver: {
        bg: "bg-surface-subtle",
        text: "text-text-muted",
        border: "border-border-subtle",
    },
};

export type BadgeInputs = {
    streak: number;
    memorizedParts: number;
    weeklyCompletionRate: number;
    isPerfectWeek: boolean;
    goalProgress?: number;
};

type BadgeDef = {
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    tone: keyof typeof TONE_CLASSES;
    unlocked: boolean;
};

function deriveBadges(inputs: BadgeInputs): BadgeDef[] {
    return [
        {
            id: "streak7",
            label: "٧ أيام",
            description: `${inputs.streak} يوم حضور متواصل`,
            icon: Flame,
            tone: "gold",
            unlocked: inputs.streak >= 7,
        },
        {
            id: "streak30",
            label: "٣٠ يوم",
            description: "شهر كامل من الالتزام",
            icon: Trophy,
            tone: "gold",
            unlocked: inputs.streak >= 30,
        },
        {
            id: "week_complete",
            label: "أسبوع مكتمل",
            description: "أنجزت خطة الأسبوع بالكامل",
            icon: CheckCircle2,
            tone: "green",
            unlocked: inputs.weeklyCompletionRate >= 100,
        },
        {
            id: "perfect_attendance",
            label: "حضور تام",
            description: "أيام هذا الأسبوع كلها حضور بلا غياب",
            icon: Star,
            tone: "blue",
            unlocked: inputs.isPerfectWeek,
        },
        {
            id: "juz_7",
            label: "٧ أجزاء",
            description: "أتممت سبعة أجزاء من القرآن",
            icon: BookOpen,
            tone: "gold",
            unlocked: inputs.memorizedParts >= 7,
        },
        {
            id: "juz_15",
            label: "نصف القرآن",
            description: "أتممت خمسة عشر جزءاً",
            icon: BookOpen,
            tone: "green",
            unlocked: inputs.memorizedParts >= 15,
        },
        {
            id: "goal_80",
            label: "اقتراب من الهدف",
            description: "تجاوزت 80% من هدفك الحالي",
            icon: Target,
            tone: "blue",
            unlocked: (inputs.goalProgress ?? 0) >= 80,
        },
    ];
}

type BadgeStripProps = {
    inputs: BadgeInputs;
    className?: string;
    showLocked?: boolean;
};

export function BadgeStrip({
    inputs,
    className,
    showLocked = false,
}: BadgeStripProps) {
    const badges = deriveBadges(inputs);
    const visible = showLocked ? badges : badges.filter((b) => b.unlocked);
    if (visible.length === 0) return null;

    return (
        <div
            className={cn(
                "rounded-[20px] border border-border-card bg-white p-4 shadow-sm",
                className,
            )}
            role="list"
            aria-label="إنجازاتي"
        >
            <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-secondary" />
                <h3 className="text-[14px] font-bold text-text-body">إنجازاتي</h3>
            </div>
            <div className="flex flex-wrap gap-2">
                {visible.map((b, i) => {
                    const tone = TONE_CLASSES[b.unlocked ? b.tone : "silver"];
                    const Icon = b.icon;
                    return (
                        <div
                            key={b.id}
                            role="listitem"
                            title={b.description}
                            style={{ animationDelay: `${i * 40}ms` }}
                            className={cn(
                                "motion-pop inline-flex items-center gap-1.5 rounded-[12px] border px-3 py-1.5",
                                tone.bg,
                                tone.border,
                                !b.unlocked && "opacity-60",
                            )}
                        >
                            <Icon className={cn("h-3.5 w-3.5", tone.text)} />
                            <span className={cn("text-[12px] font-bold", tone.text)}>
                                {b.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
