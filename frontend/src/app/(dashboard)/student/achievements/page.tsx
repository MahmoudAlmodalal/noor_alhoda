"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import type { Student, StudentStats, WeeklyPlan } from "@/types/api";
import { Award, Trophy, TrendingUp, FileText, Book, Download } from "lucide-react";

interface AchievementCertificate {
    id: number | string;
    title: string;
    date: string;
    grade: string;
    color: string;
    badgeColor: string;
}

interface DailyHistoryRow {
    date: string;
    hifz: string;
    murajaah: string;
}

interface StudentAchievementStats extends StudentStats {
    certificates?: AchievementCertificate[];
    overall_rate?: string;
    overall_grade?: string;
}

export default function StudentAchievements() {
    const { user } = useAuth();
    const studentProfileId = user?.student_profile?.id;

    const { data: profile, isLoading: isProfileLoading } = useApi<Student>(
        studentProfileId ? `/api/students/${studentProfileId}/` : null
    );

    const { data: stats, isLoading: isStatsLoading } = useApi<StudentAchievementStats>(
        studentProfileId ? `/api/students/${studentProfileId}/stats/` : null
    );

    const { data: history } = useApi<WeeklyPlan[]>(
        studentProfileId ? `/api/students/${studentProfileId}/history/` : null
    );

    if (isProfileLoading || isStatsLoading) {
        return <PageLoading />;
    }

    const overallRate = stats?.overall_rate || "94%";
    const overallGrade = stats?.overall_grade || "ممتاز";

    const mockCertificates = [
        { id: 1, title: "إتمام جزء عم", date: "1 أبريل 2026", grade: "ممتاز", color: "bg-blue-600", badgeColor: "text-slate-600 bg-slate-50 border-slate-100" },
        { id: 2, title: "إتمام جزء تبارك", date: "22 مارس 2026", grade: "جيد جداً", color: "bg-green-500", badgeColor: "text-slate-600 bg-slate-50 border-slate-100" },
        { id: 3, title: "دورة التجويد الأساسية", date: "20 فبراير 2026", grade: "مجتاز", color: "bg-purple-500", badgeColor: "text-slate-600 bg-slate-50 border-slate-100" },
    ];

    const actualCertificates: AchievementCertificate[] = stats?.certificates || mockCertificates;

    const mockDailyHistory = [
        { date: "15 يوليو 2026", hifz: "ممتاز", murajaah: "جيد جداً" },
        { date: "4 يوليو 2026", hifz: "ممتاز", murajaah: "ممتاز" },
        { date: "3 يونيو 2026", hifz: "جيد جداً", murajaah: "ممتاز" },
    ];

    const actualDailyHistory: DailyHistoryRow[] = history?.length
        ? history.map((item) => ({
            date: item.week_start,
            hifz: `${item.total_achieved}/${item.total_required}`,
            murajaah: `الأسبوع ${item.week_number}`,
        }))
        : mockDailyHistory;

    const handleDownloadPDF = async () => {
        if (!studentProfileId) return;
        const blob = await api.downloadBlob(`/api/reports/student/${studentProfileId}/pdf/`);
        if (!blob) {
            console.error("Failed to download PDF");
            return;
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${studentProfileId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 max-w-sm md:max-w-md mx-auto pb-24">
            {/* Top Banner */}
            <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 text-center flex flex-col items-center">
                <h1 className="text-xl font-bold text-primary mb-1">
                    مرحباً، {profile?.full_name?.split(' ')[0] || user?.full_name || "عمر"}
                </h1>
                <p className="text-[10px] text-slate-500 mb-4">
                    طالب مجتهد، جعلك الله قرة عين لوالديك
                </p>
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-2 inline-flex items-center gap-2">
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] text-slate-500">مستوى الحفظ الحالي</span>
                        <span className="text-xs font-bold text-primary">
                            {profile?.grade || "جزء عم - ممتاز"}
                        </span>
                    </div>
                    <Award className="w-5 h-5 text-primary" />
                </div>
            </div>

            {/* Achievement & Progress Stats */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-[#eabd5b]" />
                    <h3 className="font-bold text-sm text-slate-800">سجل الإنجاز والتقدم</h3>
                </div>
                <p className="text-[10px] text-slate-500 mb-4">متابعة دقيقة لمسيرتك في حفظ كتاب الله</p>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50/50 border border-blue-100 rounded-[20px] p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] text-blue-600 font-bold mb-2">المعدل العام</span>
                        <span className="text-2xl font-black text-primary">{overallRate}</span>
                    </div>
                    <div className="bg-green-50/50 border border-green-100 rounded-[20px] p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] text-green-600 font-bold mb-2">التقدير</span>
                        <span className="text-2xl font-black text-green-700">{overallGrade}</span>
                    </div>
                </div>
            </div>

            {/* Weekly Development Curve (Chart) */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-[#eabd5b]" />
                    <h3 className="font-bold text-sm text-slate-800">منحنى التطور الأسبوعي</h3>
                </div>

                {/* Simple SVG Chart Representation */}
                <div className="relative h-[180px] w-full mt-4 flex items-end ml-4">
                    {/* Y Axis labels */}
                    <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-slate-400">
                        <span>100</span>
                        <span>75</span>
                        <span>50</span>
                        <span>25</span>
                        <span>0</span>
                    </div>
                    {/* Y Axis line */}
                    <div className="absolute left-6 top-1 bottom-6 w-px bg-slate-200"></div>

                    {/* Chart area */}
                    <div className="ml-8 relative w-full h-full pb-6 mr-2">
                        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible preserveAspectRatio='none'">
                            <path
                                d="M 5,25 L 25,20 L 45,15 L 65,20 L 85,10 L 100,12"
                                fill="none"
                                stroke="#0b5394"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <circle cx="5" cy="25" r="3" fill="#0b5394" />
                            <circle cx="25" cy="20" r="3" fill="#0b5394" />
                            <circle cx="45" cy="15" r="3" fill="#0b5394" />
                            <circle cx="65" cy="20" r="3" fill="#0b5394" />
                            <circle cx="85" cy="10" r="3" fill="#0b5394" />
                            <circle cx="100" cy="12" r="3" fill="#0b5394" />
                        </svg>
                        <div className="absolute bottom-0 left-0 w-full flex justify-between text-[8px] text-slate-400">
                            <span className="translate-x-1">الأسبوع 1</span>
                            <span>الأسبوع 2</span>
                            <span>الأسبوع 3</span>
                            <span className="-translate-x-1">الأسبوع 4</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Certificates and Achievements */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-[#eabd5b]" />
                    <h3 className="font-bold text-sm text-slate-800">الشهادات والإنجازات</h3>
                </div>
                <div className="space-y-4">
                    {actualCertificates.map((cert) => (
                        <div key={cert.id} className="border border-slate-100 rounded-[16px] p-4 flex items-center gap-4">
                            <div className="flex-1">
                                <h4 className="font-bold text-sm text-slate-800">{cert.title}</h4>
                                <p className="text-[10px] text-slate-400 mt-0.5">{cert.date}</p>
                                <div className="mt-2">
                                    <span className={`inline-block px-3 py-1 rounded-[8px] text-[10px] font-bold border ${cert.badgeColor}`}>
                                        {cert.grade}
                                    </span>
                                </div>
                            </div>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${cert.color}`}>
                                <Book className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily Evaluations Log */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-sm text-slate-800">سجل التقييمات اليومية</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs box-content border-collapse text-center">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="py-2 px-1 text-slate-500 font-medium whitespace-nowrap">التاريخ</th>
                                <th className="py-2 px-1 text-slate-500 font-medium">المقرر (حفظاً)</th>
                                <th className="py-2 px-1 text-slate-500 font-medium">المقرر (مراجعة)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {actualDailyHistory.map((row, idx) => (
                                <tr key={idx} className="border-b border-slate-50 py-1">
                                    <td className="py-3 px-1 text-slate-500 whitespace-nowrap">{row.date}</td>
                                    <td className="py-3 px-1 font-bold text-green-600 whitespace-nowrap">{row.hifz}</td>
                                    <td className="py-3 px-1 font-bold text-blue-600 whitespace-nowrap">{row.murajaah}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Download PDF Actions */}
            <div className="flex justify-center mt-8">
                <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 bg-primary text-white font-bold py-3 px-6 rounded-xl shadow-sm hover:bg-primary/90 transition-colors"
                >
                    <Download className="w-5 h-5" />
                    <span>تحميل التقرير التفصيلي (PDF)</span>
                </button>
            </div>
        </div>
    );
}
