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

    // For students, we need their profile ID, not their user ID
    const studentProfileId = user?.student_profile?.id;

    const { data: profile, isLoading: isProfileLoading } = useApi<StudentProfile>(
        studentProfileId ? `/api/students/${studentProfileId}/` : null
    );

    const { data: stats, isLoading: isStatsLoading } = useApi<StudentStatsLike>(
        studentProfileId ? `/api/students/${studentProfileId}/stats/` : null
    );

    const { data: weeklyPlan } = useApi<WeeklyRow[]>(
        studentProfileId ? `/api/records/weekly-summary/${studentProfileId}/` : null,
        { week_start: new Date().toISOString().split("T")[0] }
    );

    const { data: history } = useApi<HistoryRow[]>(
        studentProfileId ? `/api/students/${studentProfileId}/history/` : null
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
                    tileBg="bg-[#fefce8]"
                    label="الترتيب في الحلقة"
                    value={classRank}
                />
            </div>

            {/* 4. Goal progress */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-[#0b5394]" />
                        <h3 className="text-[18px] font-bold text-[#1e2939]">
                            الهدف الحالي
                        </h3>
                    </div>
                    <span className="text-[14px] font-bold text-[#0b5394]">
                        {goalProgress}%
                    </span>
                </div>
                <p className="mb-3 text-[16px] font-bold text-[#1e2939]">
                    {currentGoal}
                </p>
                <div className="h-2 w-full rounded-full bg-[#f3f4f6]">
                    <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${goalProgress}%` }}
                    />
                </div>
            </div>

            {/* 5. Weekly plan table */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[#0b5394]" />
                    <h3 className="text-[18px] font-bold text-[#1e2939]">
                        الخطة الأسبوعية
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="border-b border-[#f3f4f6] text-[12px] font-bold text-[#6a7282]">
                                <th className="pb-3 pr-2">اليوم</th>
                                <th className="pb-3">الحضور</th>
                                <th className="pb-3">المطلوب</th>
                                <th className="pb-3">المنجز</th>
                                <th className="pb-3">التقييم</th>
                                <th className="pb-3 pl-2">النتيجة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f3f4f6]">
                            {planRows.map((row, idx) => (
                                <tr key={idx} className="text-[14px]">
                                    <td className="py-4 pr-2 font-bold text-[#1e2939]">
                                        {row.day}
                                    </td>
                                    <td className="py-4">
                                        <AttendancePill value={row.attendance} />
                                    </td>
                                    <td className="py-4 text-[#1e2939]">{row.required}</td>
                                    <td className="py-4 text-[#1e2939]">{row.achieved}</td>
                                    <td className="py-4">
                                        <RatingText value={row.evaluation} />
                                    </td>
                                    <td className="py-4 pl-2">
                                        <ResultPill value={row.result} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 6. History list */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                    <Star className="h-5 w-5 text-[#0b5394]" />
                    <h3 className="text-[18px] font-bold text-[#1e2939]">
                        آخر الإنجازات
                    </h3>
                </div>
                <div className="space-y-4">
                    {historyRows.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between rounded-[16px] border border-[#f3f4f6] p-4"
                        >
                            <div className="flex flex-col gap-1">
                                <span className="text-[16px] font-bold text-[#1e2939]">
                                    {item.title}
                                </span>
                                <span className="text-[12px] text-[#6a7282]">
                                    {item.date}
                                </span>
                            </div>
                            <RatingPill value={item.rating} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
