"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import type { StudentStats } from "@/types/api";
import {
    Award,
    BookOpen,
    Calendar,
    Flame,
    Star,
    Target,
    Trophy,
} from "lucide-react";

type Attendance = "present" | "absent" | "late" | "excused" | "upcoming";
type ResultKey = "pass" | "fail" | "pending" | "none";
type Quality = "excellent" | "good" | "acceptable" | "weak" | "none";

interface WeeklyRow {
    day: string;
    attendance: Attendance;
    required: string;
    achieved: string;
    evaluation: Quality;
    result: ResultKey;
}

interface WeeklySummaryResponse {
    student_id: string;
    student_name: string;
    week_start: string;
    week_number?: number;
    total_required?: number;
    total_achieved?: number;
    completion_rate?: number;
    days: WeeklyRow[];
    message?: string;
}

interface HistoryRow {
    id: number | string;
    title: string;
    date: string;
    rating: "excellent" | "very_good" | "good" | "none";
}

interface StudentProfile {
    full_name?: string;
    grade?: string;
    ring_name?: string;
    teacher_name?: string;
}

/** Calculate the Saturday (week start) for a given date */
function getSaturday(date: Date): string {
    const day = date.getDay(); // 0=Sun, 6=Sat
    const diff = (day + 1) % 7; // days since Saturday
    const saturday = new Date(date);
    saturday.setDate(date.getDate() - diff);
    return saturday.toISOString().split("T")[0];
}

function AttendancePill({ value }: { value: Attendance }) {
    if (value === "present") {
        return (
            <span className="inline-block rounded-[4px] bg-[#dcfce7] px-2 py-1 text-[12px] font-bold text-[#008236]">
                حاضر
            </span>
        );
    }
    if (value === "late") {
        return (
            <span className="inline-block rounded-[4px] bg-[#fef3c7] px-2 py-1 text-[12px] font-bold text-[#b45309]">
                متأخر
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
    if (value === "excused") {
        return (
            <span className="inline-block rounded-[4px] bg-[#e0e7ff] px-2 py-1 text-[12px] font-bold text-[#4338ca]">
                مستأذن
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
    if (value === "fail") {
        return (
            <span className="inline-block rounded-[4px] bg-[#ffe2e2] px-2 py-1 text-[12px] font-bold text-[#c10007]">
                راسب
            </span>
        );
    }
    if (value === "pending") {
        return (
            <span className="inline-block rounded-[4px] bg-[#fef3c7] px-2 py-1 text-[12px] font-bold text-[#b45309]">
                معلّق
            </span>
        );
    }
    return (
        <span className="inline-block rounded-[4px] bg-[#f3f4f6] px-2 py-1 text-[12px] font-bold text-[#6a7282]">
            -
        </span>
    );
}

const QUALITY_LABELS: Record<string, string> = {
    excellent: "ممتاز",
    good: "جيد جداً",
    acceptable: "جيد",
    weak: "ضعيف",
    none: "-",
};

const QUALITY_STARS: Record<string, number> = {
    excellent: 3,
    good: 2,
    acceptable: 1,
    weak: 0,
    none: 0,
};

function RatingText({ value }: { value: Quality }) {
    if (value === "excellent") {
        return <span className="text-[16px] font-bold text-[#2f944d]">ممتاز</span>;
    }
    if (value === "good") {
        return <span className="text-[16px] font-bold text-[#0b5394]">جيد جداً</span>;
    }
    if (value === "acceptable") {
        return <span className="text-[16px] font-bold text-[#ca3500]">جيد</span>;
    }
    if (value === "weak") {
        return <span className="text-[16px] font-bold text-[#c10007]">ضعيف</span>;
    }
    return <span className="text-[16px] font-bold text-[#6a7282]">-</span>;
}

function RatingPill({ value }: { value: string }) {
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

export default function StudentDashboard() {
    const { user } = useAuth();

    const studentProfileId = user?.student_profile?.id;

    const { data: profile, isLoading: isProfileLoading } = useApi<StudentProfile>(
        studentProfileId ? `/api/students/${studentProfileId}/` : null
    );

    const { data: stats, isLoading: isStatsLoading } = useApi<StudentStats>(
        studentProfileId ? `/api/students/${studentProfileId}/stats/` : null
    );

    const { data: weeklyPlan } = useApi<WeeklySummaryResponse>(
        studentProfileId ? `/api/records/weekly-summary/${studentProfileId}/` : null,
        { week_start: getSaturday(new Date()) }
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
        "طالب";
    const fullName = profile?.full_name || user?.full_name || "";
    const memorizationLevel = stats?.memorization_level || "-";
    const subtitleParts = [
        profile?.grade || "",
        profile?.ring_name || "",
        profile?.teacher_name ? `الشيخ ${profile.teacher_name}` : "",
    ].filter(Boolean);

    const points = stats?.points ?? 0;
    const memorizedParts = stats?.memorized_parts ?? 0;
    const streak = stats?.streak ?? 0;
    const absentDays = stats?.total_absent ?? 0;
    const studyDays = stats?.total_present ?? 0;
    const currentGoal = stats?.current_goal || "لم يتم تحديد هدف بعد";
    const goalProgress = stats?.goal_progress ?? 0;

    const planRows: WeeklyRow[] = weeklyPlan?.days?.length ? weeklyPlan.days : [];
    const historyRows: HistoryRow[] = history?.length ? history : [];

    // Today's evaluation from stats
    const todayRecord = stats?.today_record;

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
                    {subtitleParts.length > 0 && (
                        <p className="text-[14px] text-[#6a7282]">
                            {subtitleParts.join(" • ")}
                        </p>
                    )}
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
                    value={points.toLocaleString("ar-SA")}
                />
                <StatsTile
                    icon={<Flame className="h-6 w-6 text-[#f43f5e]" />}
                    tileBg="bg-[#fef2f2]"
                    label="الغيابات"
                    value={absentDays}
                />
                <StatsTile
                    icon={<Calendar className="h-6 w-6 text-[#0b5394]" />}
                    tileBg="bg-[#eff6ff]"
                    label="أيام الدراسة"
                    value={studyDays}
                />
            </div>

            {/* 3b. Achievement badges */}
            {streak >= 7 && (
                <div className="space-y-2">
                    {streak >= 30 && (
                        <div className="flex items-center gap-3 rounded-[14px] bg-[#fefce8] border border-[#eabd5b]/30 px-4 py-3">
                            <Trophy className="h-5 w-5 shrink-0 text-[#eabd5b]" />
                            <span className="text-[13px] font-bold text-[#1e2939]">
                                نبارك الإنجاز! {streak} يوم حضور متواصل
                            </span>
                        </div>
                    )}
                    {memorizedParts >= 7 && (
                        <div className="flex items-center gap-3 rounded-[14px] bg-[#dcfce7] border border-emerald-200 px-4 py-3">
                            <Award className="h-5 w-5 shrink-0 text-emerald-600" />
                            <span className="text-[13px] font-bold text-[#1e2939]">
                                نبارك إتمام {memorizedParts} أجزاء من القرآن الكريم
                            </span>
                        </div>
                    )}
                </div>
            )}

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
                        style={{ width: `${Math.min(goalProgress, 100)}%` }}
                    />
                </div>
            </div>

            {/* 4b. Today's Evaluation */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <Star className="h-5 w-5 text-[#eabd5b] fill-[#eabd5b]" />
                    <h3 className="text-[16px] font-bold text-[#1e2939]">تقييم اليوم</h3>
                </div>
                {todayRecord ? (
                    <div className="space-y-3">
                        {[
                            {
                                label: "الحضور",
                                value: todayRecord.attendance === "present" ? "حاضر" : todayRecord.attendance === "late" ? "متأخر" : todayRecord.attendance === "absent" ? "غائب" : "مستأذن",
                                stars: todayRecord.attendance === "present" ? 3 : todayRecord.attendance === "late" ? 2 : 0,
                                color: todayRecord.attendance === "present" ? "text-emerald-600" : todayRecord.attendance === "late" ? "text-amber-600" : "text-rose-600",
                            },
                            {
                                label: "الحفظ",
                                value: QUALITY_LABELS[todayRecord.quality] || "-",
                                stars: QUALITY_STARS[todayRecord.quality] || 0,
                                color: "text-[#0b5394]",
                            },
                            {
                                label: "المنجز",
                                value: todayRecord.achieved_verses > 0 ? `${todayRecord.achieved_verses} آيات` : "-",
                                stars: todayRecord.achieved_verses >= 5 ? 3 : todayRecord.achieved_verses >= 3 ? 2 : todayRecord.achieved_verses >= 1 ? 1 : 0,
                                color: "text-[#0b5394]",
                            },
                        ].map(({ label, value, stars, color }) => (
                            <div key={label} className="flex items-center justify-between">
                                <span className="text-[13px] text-[#6a7282] font-medium">{label}</span>
                                <div className="flex items-center gap-2">
                                    <span className={"text-[13px] font-bold " + color}>{value}</span>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3].map((s) => (
                                            <Star
                                                key={s}
                                                className={"h-3.5 w-3.5 " + (s <= stars ? "fill-[#eabd5b] text-[#eabd5b]" : "text-[#e5e7eb]")}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[13px] text-[#6a7282] text-center py-4">لا يوجد تقييم لليوم بعد</p>
                )}
            </div>

            {/* 5. Weekly plan table */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[#0b5394]" />
                    <h3 className="text-[18px] font-bold text-[#1e2939]">
                        الخطة الأسبوعية الحالية
                    </h3>
                </div>
                {planRows.length > 0 ? (
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
                ) : (
                    <p className="text-[13px] text-[#6a7282] text-center py-6">لا توجد خطة أسبوعية حالياً</p>
                )}
            </div>

            {/* 6. History list */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                    <Star className="h-5 w-5 text-[#0b5394]" />
                    <h3 className="text-[18px] font-bold text-[#1e2939]">
                        آخر الإنجازات
                    </h3>
                </div>
                {historyRows.length > 0 ? (
                    <div className="space-y-4">
                        {historyRows.slice(0, 5).map((item) => (
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
                ) : (
                    <p className="text-[13px] text-[#6a7282] text-center py-6">لا توجد إنجازات مسجلة بعد</p>
                )}
            </div>
        </div>
    );
}
