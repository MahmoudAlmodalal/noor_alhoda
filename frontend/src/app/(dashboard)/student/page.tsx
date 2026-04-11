"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import {
    Award,
    BookOpen,
    Flame,
    Star,
    Target,
    Trophy,
} from "lucide-react";

type Attendance = "present" | "absent" | "upcoming";
type ResultKey = "pass" | "none";
type Rating = "excellent" | "very_good" | "good" | "none";

interface WeeklyRow {
    day: string;
    attendance: Attendance;
    required: string;
    achieved: string;
    evaluation: Rating;
    result: ResultKey;
}

interface HistoryRow {
    id: number | string;
    title: string;
    date: string;
    rating: Rating;
}

const FIGMA_WEEKLY: WeeklyRow[] = [
    { day: "السبت", attendance: "present", required: "5 آيات", achieved: "5 آيات", evaluation: "excellent", result: "pass" },
    { day: "الأحد", attendance: "present", required: "5 آيات", achieved: "5 آيات", evaluation: "very_good", result: "pass" },
    { day: "الإثنين", attendance: "present", required: "مراجعة وجه", achieved: "وجه كامل", evaluation: "excellent", result: "pass" },
    { day: "الثلاثاء", attendance: "present", required: "5 آيات", achieved: "5 آيات", evaluation: "excellent", result: "pass" },
    { day: "الأربعاء", attendance: "absent", required: "-", achieved: "-", evaluation: "none", result: "none" },
    { day: "الخميس", attendance: "upcoming", required: "مراجعة", achieved: "-", evaluation: "none", result: "none" },
];

const FIGMA_HISTORY: HistoryRow[] = [
    { id: 1, title: "تسميع سورة الملك (1-10)", date: "12 شعبان 1447", rating: "excellent" },
    { id: 2, title: "مراجعة سورة القلم", date: "11 شعبان 1447", rating: "very_good" },
    { id: 3, title: "تسميع سورة الحاقة", date: "10 شعبان 1447", rating: "excellent" },
    { id: 4, title: "مراجعة جزء تبارك", date: "9 شعبان 1447", rating: "good" },
    { id: 5, title: "تسميع سورة الملك (11-20)", date: "8 شعبان 1447", rating: "excellent" },
];

function AttendancePill({ value }: { value: Attendance }) {
    if (value === "present") {
        return (
            <span className="inline-block rounded-[4px] bg-[#dcfce7] px-2 py-1 text-[12px] font-bold text-[#008236]">
                حاضر
            </span>
        );
    }
    if (value === "absent") {
        return (
            <span className="inline-block rounded-[4px] bg-[#ffe2e2] px-2 py-1 text-[12px] font-bold text-[#c10007]">
                غائب
            </span>
        );
    }
    return (
        <span className="inline-block rounded-[4px] bg-[#f3f4f6] px-2 py-1 text-[12px] font-bold text-[#6a7282]">
            قادم
        </span>
    );
}

function ResultPill({ value }: { value: ResultKey }) {
    if (value === "pass") {
        return (
            <span className="inline-block rounded-[4px] bg-[#dcfce7] px-2 py-1 text-[12px] font-bold text-[#008236]">
                ناجح
            </span>
        );
    }
    return (
        <span className="inline-block rounded-[4px] bg-[#f3f4f6] px-2 py-1 text-[12px] font-bold text-[#6a7282]">
            -
        </span>
    );
}

function RatingText({ value }: { value: Rating }) {
    if (value === "excellent") {
        return <span className="text-[16px] font-bold text-[#2f944d]">ممتاز</span>;
    }
    if (value === "very_good") {
        return <span className="text-[16px] font-bold text-[#0b5394]">جيد جداً</span>;
    }
    if (value === "good") {
        return <span className="text-[16px] font-bold text-[#ca3500]">جيد</span>;
    }
    return <span className="text-[16px] font-bold text-[#6a7282]">-</span>;
}

function RatingPill({ value }: { value: Rating }) {
    if (value === "excellent") {
        return (
            <span className="inline-block rounded-[10px] bg-[#dcfce7] px-3 py-1 text-[14px] font-bold text-[#008236]">
                ممتاز
            </span>
        );
    }
    if (value === "very_good") {
        return (
            <span className="inline-block rounded-[10px] bg-[#dbeafe] px-3 py-1 text-[14px] font-bold text-[#1447e6]">
                جيد جداً
            </span>
        );
    }
    if (value === "good") {
        return (
            <span className="inline-block rounded-[10px] bg-[#ffedd4] px-3 py-1 text-[14px] font-bold text-[#ca3500]">
                جيد
            </span>
        );
    }
    return null;
}

function StatsTile({
    icon,
    tileBg,
    label,
    value,
    labelMaxWidth,
}: {
    icon: React.ReactNode;
    tileBg: string;
    label: string;
    value: string | number;
    labelMaxWidth?: string;
}) {
    return (
        <div className="flex h-[180px] flex-col items-center justify-center rounded-[16px] border border-[#f3f4f6] bg-white px-4 shadow-sm">
            <div
                className={`mb-3 flex h-14 w-14 items-center justify-center rounded-[14px] ${tileBg}`}
            >
                {icon}
            </div>
            <span
                className={`mb-1 text-center text-[12px] font-bold text-[#6a7282] leading-tight ${labelMaxWidth ?? ""}`}
            >
                {label}
            </span>
            <span className="text-[30px] font-bold leading-9 text-[#1e2939]">
                {value}
            </span>
        </div>
    );
}

interface StudentProfile {
    full_name?: string;
    grade?: string;
    ring_name?: string;
    teacher_name?: string;
}

interface StudentStatsLike {
    points?: number | string;
    memorized_parts?: number;
    streak?: number;
    class_rank?: number;
    current_goal?: string;
    goal_progress?: number;
    memorization_level?: string;
}

export default function StudentDashboard() {
    const { user } = useAuth();

    const { data: profile, isLoading: isProfileLoading } = useApi<StudentProfile>(
        user?.id ? `/api/students/${user.id}/` : null
    );

    const { data: stats, isLoading: isStatsLoading } = useApi<StudentStatsLike>(
        user?.id ? `/api/students/${user.id}/stats/` : null
    );

    const { data: weeklyPlan } = useApi<WeeklyRow[]>(
        user?.id ? `/api/records/weekly-summary/${user.id}/` : null,
        { week_start: new Date().toISOString().split("T")[0] }
    );

    const { data: history } = useApi<HistoryRow[]>(
        user?.id ? `/api/students/${user.id}/history/` : null
    );

    if (isProfileLoading || isStatsLoading) {
        return <PageLoading />;
    }

    const firstName =
        profile?.full_name?.split(" ")[0] ||
        user?.full_name?.split(" ")[0] ||
        "عمر";
    const fullName = profile?.full_name || user?.full_name || "أحمد محمد";
    const memorizationLevel = stats?.memorization_level || "جزء عم - ممتاز";
    const subtitleParts = [
        profile?.grade || "الصف الأول المتوسط",
        profile?.ring_name || "حلقة الفجر",
        profile?.teacher_name ? `الشيخ ${profile.teacher_name}` : "الشيخ محمد عبدالله",
    ];

    const points = stats?.points ?? "1,250";
    const memorizedParts = stats?.memorized_parts ?? 3;
    const streak = stats?.streak ?? 14;
    const classRank = stats?.class_rank ?? 2;
    const currentGoal = stats?.current_goal || "حفظ سورة الملك";
    const goalProgress = stats?.goal_progress ?? 80;

    const planRows: WeeklyRow[] =
        weeklyPlan && weeklyPlan.length ? weeklyPlan : FIGMA_WEEKLY;
    const historyRows: HistoryRow[] =
        history && history.length ? history : FIGMA_HISTORY;

    return (
        <div className="mx-auto max-w-md space-y-8 pb-24" dir="rtl">
            {/* 1. Header card */}
            <div className="flex items-center justify-between gap-4 rounded-[16px] border-t-[3px] border-t-primary bg-white px-5 pb-4 pt-[18px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)]">
                <div className="flex flex-col gap-1">
                    <h1 className="text-[24px] font-bold leading-8 text-[#0b5394]">
                        مرحباً، {firstName}
                    </h1>
                    <p className="text-[14px] text-[#6a7282]">
                        طالب مجتهد، جعلك الله قرة عين لوالديك
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 rounded-[10px] border border-primary/20 bg-[#eff6ff] px-4 py-2">
                    <div className="flex flex-col text-right">
                        <span className="text-[12px] text-[#6a7282]">
                            مستوى الحفظ الحالي
                        </span>
                        <span className="text-[16px] font-bold text-[#0b5394]">
                            {memorizationLevel}
                        </span>
                    </div>
                    <Award className="h-6 w-6 text-[#1e88e5]" />
                </div>
            </div>

            {/* 2. Profile card */}
            <div className="flex items-center justify-between gap-4 rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="text-[24px] font-bold leading-8 text-[#0b5394]">
                        السلام عليكم، {fullName}
                    </h2>
                    <p className="text-[14px] text-[#6a7282]">
                        {subtitleParts.join(" • ")}
                    </p>
                </div>
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#eabd5b] bg-[#fcf8ef] text-[30px]">
                    👤
                </div>
            </div>

            {/* 3. Stats grid */}
            <div className="grid grid-cols-2 gap-4">
                <StatsTile
                    icon={<BookOpen className="h-6 w-6 text-[#1e88e5]" />}
                    tileBg="bg-[#eff6ff]"
                    label="الأجزاء المحفوظة"
                    value={memorizedParts}
                />
                <StatsTile
                    icon={<Star className="h-6 w-6 fill-[#eabd5b] text-[#eabd5b]" />}
                    tileBg="bg-[#fefce8]"
                    label="النقاط"
                    value={points}
                />
                <StatsTile
                    icon={<Flame className="h-6 w-6 text-[#f43f5e]" />}
                    tileBg="bg-[#fef2f2]"
                    label="أيام الحضور المتتالية"
                    value={streak}
                    labelMaxWidth="max-w-[90px]"
                />
                <StatsTile
                    icon={<Trophy className="h-6 w-6 text-[#eabd5b]" />}
                    tileBg="bg-[#fff7ed]"
                    label="الترتيب في الحلقة"
                    value={classRank}
                />
            </div>

            {/* 4. Badges */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-end gap-2">
                    <h3 className="text-[20px] font-bold text-[#1e2939]">
                        شارات الإنجاز
                    </h3>
                    <Trophy className="h-6 w-6 text-[#eabd5b]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex h-32 flex-col items-start justify-start gap-2 rounded-[16px] bg-[#0b5394] p-5 text-white shadow-lg">
                        <span className="w-full text-center text-[36px] leading-none">
                            📖
                        </span>
                        <span className="w-full text-center text-[14px] font-bold leading-5">
                            حافظ سورة البقرة
                        </span>
                    </div>
                    <div className="flex h-32 flex-col items-start justify-start gap-2 rounded-[16px] bg-[#f43f5e] p-5 text-white shadow-lg">
                        <span className="w-full text-center text-[36px] leading-none">
                            🔥
                        </span>
                        <span className="w-full text-center text-[14px] font-bold leading-5">
                            30 يوم متواصل
                        </span>
                    </div>
                    <div className="flex h-28 flex-col items-start justify-start gap-2 rounded-[16px] bg-[#eabd5b] p-5 text-white shadow-lg">
                        <span className="w-full text-center text-[36px] leading-none">
                            ⭐
                        </span>
                        <span className="w-full text-center text-[14px] font-bold leading-5">
                            متفوق الشهر
                        </span>
                    </div>
                    <div className="flex h-28 flex-col items-start justify-start gap-2 rounded-[16px] bg-[#f3f4f6] p-5 opacity-60">
                        <span className="w-full text-center text-[36px] leading-none text-[#99a1af]">
                            🎯
                        </span>
                        <span className="w-full text-center text-[14px] font-bold leading-5 text-[#99a1af]">
                            حفظ 5 أجزاء
                        </span>
                    </div>
                </div>
            </div>

            {/* 5. Goal card */}
            <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-l from-[#0b5394] to-[#1565c0] p-8 text-white shadow-lg">
                <div className="pointer-events-none absolute -right-16 -top-32 h-64 w-64 rounded-full bg-white/5" />
                <div className="relative">
                    <div className="mb-5 flex items-center justify-end gap-3">
                        <h3 className="text-[24px] font-bold leading-8">
                            الهدف الحالي: {currentGoal}
                        </h3>
                        <Target className="h-6 w-6 text-[#eabd5b]" />
                    </div>
                    <p className="mb-6 text-[18px] leading-7 text-[#dbeafe]">
                        أنت على وشك إتمام حفظ سورة الملك! استمر في المراجعة اليومية
                        لتحقيق هدفك بامتياز.
                    </p>
                    <div className="mb-2 flex items-center justify-between text-[14px] font-bold text-white">
                        <span>{goalProgress}%</span>
                        <span>نسبة الإنجاز</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-black/20">
                        <div
                            className="h-full rounded-full bg-gradient-to-l from-[#eabd5b] to-[#f0c674]"
                            style={{ width: `${goalProgress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* 6. Today's evaluation */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-end gap-2">
                    <h3 className="text-[20px] font-bold text-[#1e2939]">تقييم اليوم</h3>
                    <Star className="h-6 w-6 text-[#eabd5b]" />
                </div>
                <div className="space-y-4">
                    <EvalRow
                        label="الحفظ الجديد"
                        labelColor="text-[#00a63e]"
                        valueColor="text-[#016630]"
                        valueText="ممتاز"
                        background="bg-[#f0fdf4]"
                        border="border-[#dcfce7]"
                        starColor="text-[#00a63e] fill-[#00a63e]"
                        filled={3}
                    />
                    <EvalRow
                        label="المراجعة الصغرى"
                        labelColor="text-[#155dfc]"
                        valueColor="text-[#193cb8]"
                        valueText="جيد جداً"
                        background="bg-[#eff6ff]"
                        border="border-[#dbeafe]"
                        starColor="text-[#155dfc] fill-[#155dfc]"
                        filled={2}
                    />
                    <EvalRow
                        label="السلوك والمواظبة"
                        labelColor="text-[#9810fa]"
                        valueColor="text-[#6e11b0]"
                        valueText="ممتاز"
                        background="bg-[#faf5ff]"
                        border="border-[#f3e8ff]"
                        starColor="text-[#9810fa] fill-[#9810fa]"
                        filled={3}
                    />
                </div>
            </div>

            {/* 7. Weekly plan */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-end gap-2">
                    <h3 className="text-[20px] font-bold text-[#1e2939]">
                        الخطة الأسبوعية الحالية
                    </h3>
                    <BookOpen className="h-6 w-6 text-[#eabd5b]" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-right">
                        <thead>
                            <tr className="bg-[#f9fafb]">
                                <th className="rounded-r-[14px] px-3 py-4 text-[16px] font-bold text-[#364153]">
                                    اليوم
                                </th>
                                <th className="px-3 py-4 text-[16px] font-bold text-[#364153]">
                                    الحضور
                                </th>
                                <th className="px-3 py-4 text-[16px] font-bold text-[#364153]">
                                    المطلوب
                                </th>
                                <th className="px-3 py-4 text-[16px] font-bold text-[#364153]">
                                    المحقق
                                </th>
                                <th className="px-3 py-4 text-[16px] font-bold text-[#364153]">
                                    التقييم
                                </th>
                                <th className="rounded-l-[14px] px-3 py-4 text-[16px] font-bold text-[#364153]">
                                    النتيجة
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {planRows.map((row, idx) => (
                                <tr
                                    key={`${row.day}-${idx}`}
                                    className="border-b border-[#f3f4f6] last:border-b-0"
                                >
                                    <td className="px-3 py-4 text-[16px] font-bold text-[#1e2939] whitespace-nowrap">
                                        {row.day}
                                    </td>
                                    <td className="px-3 py-4">
                                        <AttendancePill value={row.attendance} />
                                    </td>
                                    <td className="px-3 py-4 text-[16px] text-[#4a5565] whitespace-nowrap">
                                        {row.required}
                                    </td>
                                    <td className="px-3 py-4 text-[16px] font-bold text-[#1e2939] whitespace-nowrap">
                                        {row.achieved}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap">
                                        <RatingText value={row.evaluation} />
                                    </td>
                                    <td className="px-3 py-4">
                                        <ResultPill value={row.result} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 8. Last evaluations */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-end gap-2">
                    <h3 className="text-[20px] font-bold text-[#1e2939]">آخر التقييمات</h3>
                    <Star className="h-6 w-6 text-[#eabd5b]" />
                </div>
                <div className="space-y-3">
                    {historyRows.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between gap-4 rounded-[14px] border border-[#f3f4f6] px-4 py-4"
                        >
                            <div className="flex items-center gap-3">
                                <span className="inline-block rounded-[10px] bg-[#dcfce7] px-3 py-1 text-[14px] font-bold text-[#008236]">
                                    ناجح
                                </span>
                                <RatingPill value={item.rating} />
                            </div>
                            <div className="flex flex-col items-end gap-1 text-right">
                                <h4 className="text-[18px] font-bold leading-7 text-[#1e2939]">
                                    {item.title}
                                </h4>
                                <p className="text-[14px] text-[#6a7282]">{item.date}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function EvalRow({
    label,
    labelColor,
    valueColor,
    valueText,
    background,
    border,
    starColor,
    filled,
}: {
    label: string;
    labelColor: string;
    valueColor: string;
    valueText: string;
    background: string;
    border: string;
    starColor: string;
    filled: number;
}) {
    return (
        <div
            className={`flex flex-col gap-1 rounded-[14px] border px-4 py-3 ${background} ${border}`}
        >
            <p className={`text-right text-[14px] font-bold ${labelColor}`}>{label}</p>
            <div className="flex items-center justify-between">
                <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                        <Star
                            key={i}
                            className={`h-4 w-4 ${
                                i < filled ? starColor : "text-[#e5e7eb]"
                            }`}
                        />
                    ))}
                </div>
                <p className={`text-[18px] font-bold ${valueColor}`}>{valueText}</p>
            </div>
        </div>
    );
}
