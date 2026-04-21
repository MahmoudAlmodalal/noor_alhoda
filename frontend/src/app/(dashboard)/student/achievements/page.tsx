"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import type { StudentWithTeacher } from "@/hooks/queries";
import type { HistoryEntry as HistoryEntryBase, StudentStats } from "@/types/api";
import { Award, Trophy, TrendingUp, FileText, Book, Download } from "lucide-react";

interface HistoryEntry extends HistoryEntryBase {
    title?: string;
    rating?: string;
    week_number?: number;
    total_required?: number;
    total_achieved?: number;
    completion_rate?: number;
}

export default function StudentAchievements() {
    const { user } = useAuth();
    const studentProfileId = user?.student_profile?.id;

    const { data: profile, isLoading: isProfileLoading } = useQuery<StudentWithTeacher>(
        studentProfileId ? "student" : null,
        studentProfileId ? { id: studentProfileId } : undefined
    );

    const { data: stats, isLoading: isStatsLoading } = useQuery<StudentStats>(
        studentProfileId ? "student_stats" : null,
        studentProfileId ? { student_id: studentProfileId } : undefined
    );

    const { data: history } = useQuery<HistoryEntry[]>(
        studentProfileId ? "student_history" : null,
        studentProfileId ? { student_id: studentProfileId } : undefined
    );

    if (isProfileLoading || isStatsLoading) {
        return <PageLoading />;
    }

    const overallRate = stats?.overall_rate || "0%";
    const overallGrade = stats?.avg_grade || "-";

    const achievements = (history || [])
        .map((h) => ({
            ...h,
            rate:
                (h.required_verses ?? 0) > 0
                    ? Math.round(((h.achieved_verses ?? 0) / (h.required_verses || 1)) * 100)
                    : 0,
        }))
        .filter((h) => h.rate >= 75)
        .slice(0, 5)
        .map((h, idx) => {
            const colors = ["bg-blue-600", "bg-green-500", "bg-purple-500", "bg-amber-500", "bg-rose-500"];
            const gradeLabel = h.rate >= 90 ? "ممتاز" : h.rate >= 75 ? "جيد جداً" : "جيد";
            return {
                id: h.id,
                title: h.title ?? h.date,
                date: h.date,
                grade: gradeLabel,
                color: colors[idx % colors.length],
                badgeColor: "text-slate-600 bg-slate-50 border-slate-100",
            };
        });

    const dailyHistory = (history || []).slice(0, 10).map((item, idx) => ({
        date: item.date,
        hifz: (item.achieved_verses ?? 0) > 0
            ? `${item.achieved_verses}/${item.required_verses}`
            : "-",
        murajaah: `الأسبوع ${item.week_number ?? idx + 1}`,
    }));

    const chartWeeks = (history || []).slice(0, 4).reverse();
    const chartPoints = chartWeeks.map((w, i) => {
        const x = chartWeeks.length <= 1 ? 50 : 5 + (i * 95) / (chartWeeks.length - 1);
        const rate = (w.required_verses ?? 0) > 0
            ? Math.round(((w.achieved_verses ?? 0) / (w.required_verses || 1)) * 100)
            : 0;
        const y = 100 - Math.min(rate, 100);
        return { x, y };
    });
    const chartPath = chartPoints.length >= 2
        ? `M ${chartPoints.map((p) => `${p.x},${p.y}`).join(" L ")}`
        : "";

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
                    مرحباً، {profile?.full_name?.split(' ')[0] || user?.full_name || "طالب"}
                </h1>
                <p className="text-[10px] text-slate-500 mb-4">
                    طالب مجتهد، جعلك الله قرة عين لوالديك
                </p>
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-2 inline-flex items-center gap-2">
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] text-slate-500">مستوى الحفظ الحالي</span>
                        <span className="text-xs font-bold text-primary">
                            {stats?.memorization_level || "-"}
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

                {chartPoints.length >= 2 ? (
                    <div className="relative h-[180px] w-full mt-4 flex items-end ml-4">
                        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-slate-400">
                            <span>100</span>
                            <span>75</span>
                            <span>50</span>
                            <span>25</span>
                            <span>0</span>
                        </div>
                        <div className="absolute left-6 top-1 bottom-6 w-px bg-slate-200"></div>

                        <div className="ml-8 relative w-full h-full pb-6 mr-2">
                            <svg viewBox="0 0 110 100" className="w-full h-full overflow-visible">
                                <path
                                    d={chartPath}
                                    fill="none"
                                    stroke="#0b5394"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                {chartPoints.map((p, i) => (
                                    <circle key={i} cx={p.x} cy={p.y} r="3" fill="#0b5394" />
                                ))}
                            </svg>
                            <div className="absolute bottom-0 left-0 w-full flex justify-between text-[8px] text-slate-400">
                                {chartWeeks.map((w, i) => (
                                    <span key={i}>الأسبوع {w.week_number ?? i + 1}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-[10px] text-slate-400 text-center py-8">لا توجد بيانات كافية لعرض المنحنى</p>
                )}
            </div>

            {/* Achievements */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <Award className="w-5 h-5 text-[#eabd5b]" />
                    <h3 className="font-bold text-sm text-slate-800">الإنجازات</h3>
                </div>
                {achievements.length > 0 ? (
                    <div className="space-y-4">
                        {achievements.map((cert) => (
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
                ) : (
                    <p className="text-[10px] text-slate-400 text-center py-6">لا توجد إنجازات مسجلة بعد</p>
                )}
            </div>

            {/* Daily Evaluations Log */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-sm text-slate-800">سجل التقييمات</h3>
                </div>

                {dailyHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs box-content border-collapse text-center">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="py-2 px-1 text-slate-500 font-medium whitespace-nowrap">التاريخ</th>
                                    <th className="py-2 px-1 text-slate-500 font-medium">المنجز/المطلوب</th>
                                    <th className="py-2 px-1 text-slate-500 font-medium">الأسبوع</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyHistory.map((row, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 py-1">
                                        <td className="py-3 px-1 text-slate-500 whitespace-nowrap">{row.date}</td>
                                        <td className="py-3 px-1 font-bold text-green-600 whitespace-nowrap">{row.hifz}</td>
                                        <td className="py-3 px-1 font-bold text-blue-600 whitespace-nowrap">{row.murajaah}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-[10px] text-slate-400 text-center py-6">لا توجد تقييمات مسجلة بعد</p>
                )}
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
