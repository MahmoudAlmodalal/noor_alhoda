"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { QualityPill, QualityStars, QUALITY_LABELS, type Quality } from "@/components/student/QualityLabel";
import { ReviewCompleteButton } from "@/components/student/ReviewCompleteButton";
import type { TodayTasks } from "@/types/api";
import {
    BookOpen,
    Calendar,
    CheckCircle2,
    ClipboardCheck,
    ClipboardList,
    GraduationCap,
    Moon,
    RotateCcw,
    Target,
} from "lucide-react";

const ATTENDANCE_LABELS: Record<string, string> = {
    present: "حاضر",
    absent: "غائب",
    late: "متأخر",
    excused: "مستأذن",
    upcoming: "لم يُسجَّل بعد",
};

function formatArabicDate(iso: string): string {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleDateString("ar", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    } catch {
        return iso;
    }
}

function StatusPill({ status }: { status: "pending" | "in_progress" | "done" }) {
    if (status === "done") {
        return (
            <span className="inline-flex items-center gap-1 rounded-[10px] bg-[#dcfce7] px-3 py-1 text-[12px] font-bold text-[#008236]">
                <CheckCircle2 className="h-3.5 w-3.5" /> أنجزت
            </span>
        );
    }
    if (status === "in_progress") {
        return (
            <span className="inline-block rounded-[10px] bg-[#fef3c7] px-3 py-1 text-[12px] font-bold text-[#b45309]">
                قيد التنفيذ
            </span>
        );
    }
    return (
        <span className="inline-block rounded-[10px] bg-[#eff6ff] px-3 py-1 text-[12px] font-bold text-[#1447e6]">
            بانتظار التنفيذ
        </span>
    );
}

function SectionHeader({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
    return (
        <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                {icon}
                <h3 className="text-[18px] font-bold text-[#1e2939]">{title}</h3>
            </div>
            {hint && <span className="text-[12px] font-medium text-[#6a7282]">{hint}</span>}
        </div>
    );
}

export default function StudentTasksPage() {
    const { user } = useAuth();
    const studentProfileId = user?.student_profile?.id;

    const { data, isLoading, refetch } = useApi<TodayTasks>(
        studentProfileId ? `/api/students/${studentProfileId}/tasks/today/` : null
    );

    if (isLoading || !data) {
        return <PageLoading />;
    }

    const { is_rest_day, memorization, reviews, upcoming_tests, weekly_progress, today } = data;
    const completionPct = Math.min(Math.round(weekly_progress.completion_rate || 0), 100);

    return (
        <div className="mx-auto max-w-md space-y-6 pb-24" dir="rtl">
            {/* Header */}
            <div className="rounded-[16px] border-t-[3px] border-t-primary bg-white px-5 pb-4 pt-[18px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-3">
                    <ClipboardList className="h-6 w-6 text-[#0b5394]" />
                    <h1 className="text-[24px] font-bold leading-8 text-[#0b5394]">مهامي اليوم</h1>
                </div>
                <p className="mt-1 text-[13px] text-[#6a7282]">{formatArabicDate(today)}</p>
            </div>

            {/* Friday notice */}
            {is_rest_day && (
                <div className="flex items-start gap-3 rounded-[16px] border border-[#eabd5b]/30 bg-[#fefce8] p-4">
                    <Moon className="h-5 w-5 shrink-0 text-[#eabd5b]" />
                    <div>
                        <p className="text-[14px] font-bold text-[#1e2939]">يوم الجمعة</p>
                        <p className="mt-0.5 text-[12px] text-[#6a7282]">
                            لا يوجد حفظ اليوم. المراجعة متاحة إن أردت الاستزادة.
                        </p>
                    </div>
                </div>
            )}

            {/* Today's memorization */}
            {!is_rest_day && (
                <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                    <SectionHeader
                        icon={<BookOpen className="h-5 w-5 text-[#0b5394]" />}
                        title="حفظ اليوم"
                        hint={memorization?.day_label}
                    />
                    {memorization && memorization.required_verses > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[16px] font-bold text-[#1e2939]">
                                        {memorization.surah_name || "—"}
                                    </p>
                                    <p className="mt-1 text-[12px] text-[#6a7282]">
                                        {ATTENDANCE_LABELS[memorization.attendance] ?? ""}
                                    </p>
                                </div>
                                <StatusPill status={memorization.status} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-[14px] bg-[#eff6ff] p-3 text-center">
                                    <p className="text-[11px] text-[#6a7282]">المطلوب</p>
                                    <p className="mt-1 text-[20px] font-bold text-[#0b5394]">
                                        {memorization.required_verses}
                                    </p>
                                    <p className="text-[10px] text-[#6a7282]">آية</p>
                                </div>
                                <div className="rounded-[14px] bg-[#dcfce7] p-3 text-center">
                                    <p className="text-[11px] text-[#6a7282]">المنجز</p>
                                    <p className="mt-1 text-[20px] font-bold text-[#008236]">
                                        {memorization.achieved_verses}
                                    </p>
                                    <p className="text-[10px] text-[#6a7282]">آية</p>
                                </div>
                            </div>

                            {memorization.quality !== "none" && (
                                <div className="flex items-center justify-between rounded-[12px] border border-[#f3f4f6] p-3">
                                    <span className="text-[13px] font-medium text-[#6a7282]">تقييم اليوم</span>
                                    <div className="flex items-center gap-2">
                                        <QualityPill value={memorization.quality as Quality} />
                                        <QualityStars value={memorization.quality as Quality} />
                                    </div>
                                </div>
                            )}

                            {memorization.note && (
                                <p className="rounded-[12px] bg-[#fefce8] p-3 text-[12px] text-[#6a7282]">
                                    ملاحظة المحفظ: {memorization.note}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="py-4 text-center text-[13px] text-[#6a7282]">
                            لا يوجد حفظ مسجّل لليوم.
                        </p>
                    )}
                </div>
            )}

            {/* Review/Revision */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <SectionHeader
                    icon={<RotateCcw className="h-5 w-5 text-[#0b5394]" />}
                    title="المراجعة"
                    hint={`كل ${data.review_interval_days} يوم`}
                />
                {reviews.length > 0 ? (
                    <div className="space-y-3">
                        {reviews.map((r) => (
                            <div
                                key={r.surah_name}
                                className="flex items-center justify-between rounded-[14px] border border-[#f3f4f6] p-3"
                            >
                                <div className="flex min-w-0 flex-col">
                                    <span className="text-[14px] font-bold text-[#1e2939]">{r.surah_name}</span>
                                    <span className="text-[11px] text-[#6a7282]">
                                        {r.last_review_date
                                            ? `آخر مراجعة: منذ ${r.days_since_review} يوم`
                                            : `محفوظ منذ ${r.days_since_review} يوم`}
                                    </span>
                                </div>
                                {studentProfileId && (
                                    <ReviewCompleteButton
                                        studentId={studentProfileId}
                                        surahName={r.surah_name}
                                        onComplete={() => refetch()}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="py-4 text-center text-[13px] text-[#6a7282]">
                        لا توجد مراجعات مستحقة اليوم.
                    </p>
                )}
            </div>

            {/* Upcoming tests */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <SectionHeader
                    icon={<GraduationCap className="h-5 w-5 text-[#0b5394]" />}
                    title="اختبارات قادمة"
                />
                {upcoming_tests.length > 0 ? (
                    <div className="space-y-3">
                        {upcoming_tests.map((t) => (
                            <div key={t.id} className="rounded-[14px] border border-[#f3f4f6] p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[14px] font-bold text-[#1e2939]">{t.title}</span>
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#0b5394]">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {formatArabicDate(t.scheduled_date)}
                                    </span>
                                </div>
                                {t.surah_range && (
                                    <p className="mt-1 text-[12px] text-[#6a7282]">{t.surah_range}</p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="py-4 text-center text-[13px] text-[#6a7282]">
                        لا توجد اختبارات مجدولة.
                    </p>
                )}
            </div>

            {/* Weekly progress */}
            <div className="rounded-[24px] border border-[#f3f4f6] bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-[#0b5394]" />
                        <h3 className="text-[18px] font-bold text-[#1e2939]">التقدّم الأسبوعي</h3>
                    </div>
                    <span className="text-[14px] font-bold text-[#0b5394]">{completionPct}%</span>
                </div>
                <p className="mb-3 text-[13px] text-[#6a7282]">
                    {weekly_progress.total_achieved} / {weekly_progress.total_required} آية هذا الأسبوع
                </p>
                <div className="h-2.5 w-full rounded-full bg-[#f3f4f6]">
                    <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${completionPct}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
