"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { Star, Flame, Trophy, BookOpen, Target, CheckCircle2, Award, FileText } from "lucide-react";

export default function StudentDashboard() {
    const { user } = useAuth();
    const { data: profile, isLoading: isProfileLoading } = useApi<any>(
        user?.id ? `/api/students/${user.id}/` : null
    );

    const { data: stats, isLoading: isStatsLoading } = useApi<any>(
        user?.id ? `/api/students/${user.id}/stats/` : null
    );

    const { data: weeklyPlan, isLoading: isPlanLoading } = useApi<any[]>(
        user?.id ? `/api/records/weekly-summary/${user.id}/` : null, // we omit week_start to default to current week in backend or pass it if necessary
        { week_start: new Date().toISOString().split('T')[0] }
    );

    const { data: history, isLoading: isHistoryLoading } = useApi<any[]>(
        user?.id ? `/api/students/${user.id}/history/` : null
    );

    if (isProfileLoading || isStatsLoading) {
        return <PageLoading />;
    }

    // Fallback to defaults to match Figma if API is empty/not fully implemented
    const points = stats?.points || "1,250";
    const streak = stats?.streak || 14;
    const absences = stats?.absences || 2;
    const memorizedParts = stats?.memorized_parts || 3;
    const currentGoal = stats?.current_goal || "حفظ سورة الملك";
    const goalProgress = stats?.goal_progress || 80;

    const mockWeeklyPlan = [
        { day: "السبت", material: "آيات 1-10", status: "ممتاز", statusColor: "text-green-600 bg-green-50", target: "5 آيات" },
        { day: "الأحد", material: "آيات 11-15", status: "ممتاز", statusColor: "text-green-600 bg-green-50", target: "5 آيات" },
        { day: "الإثنين", material: "آيات 16-20", status: "ممتاز", statusColor: "text-green-600 bg-green-50", target: "مراجعة فقط" },
        { day: "الثلاثاء", material: "آيات 21-25", status: "جيد جداً", statusColor: "text-blue-600 bg-blue-50", target: "5 آيات" },
        { day: "الأربعاء", material: "-", status: "غائب", statusColor: "text-red-600 bg-red-50", target: "-" },
        { day: "الخميس", material: "راحة", status: "راحة", statusColor: "text-slate-500 bg-slate-100", target: "راحة" },
    ];

    const actualPlan = weeklyPlan?.length ? weeklyPlan : mockWeeklyPlan;

    const mockHistory = [
        { id: 1, title: "تسميع سورة الملك (1-10)", date: "15 شعبان 1445", rating: "ممتاز", ratingColor: "text-green-600 bg-green-50" },
        { id: 2, title: "مراجعة سورة القلم", date: "12 شعبان 1445", rating: "جيد جداً", ratingColor: "text-blue-600 bg-blue-50" },
        { id: 3, title: "تسميع سورة الحاقة", date: "10 شعبان 1445", rating: "ممتاز", ratingColor: "text-green-600 bg-green-50" },
        { id: 4, title: "مراجعة جزء تبارك", date: "5 شعبان 1445", rating: "جيد", ratingColor: "text-orange-600 bg-orange-50" },
    ];

    const actualHistory = history?.length ? history : mockHistory;

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

            {/* Teacher Box */}
            {profile?.teacher_name && (
                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center shrink-0 border border-[#e6b150]/20">
                        <FileText className="w-4 h-4 text-[#e6b150]" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-primary">
                            السلام عليكم، {profile.teacher_name}
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            معلم حلقة التلقين وبناء الحفظ
                        </p>
                    </div>
                </div>
            )}

            {!profile?.teacher_name && (
                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center shrink-0 border border-slate-200">
                        <span className="text-sm text-slate-400 font-bold">أ</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-primary">
                            السلام عليكم، أحمد محمد
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            ولي أمر الطالب مسجل في حلقات التحفيظ
                        </p>
                    </div>
                </div>
            )}

            {/* 4 Grid Stats */}
            <div className="grid grid-cols-2 gap-3">
                <StatsCard icon={<BookOpen className="w-5 h-5 text-primary" />} bg="bg-blue-50" label="الأجزاء المحفوظة" value={memorizedParts} />
                <StatsCard icon={<Star className="w-5 h-5 text-[#e6b150]" />} bg="bg-orange-50" label="النقاط" value={points} />
                <StatsCard icon={<Trophy className="w-5 h-5 text-slate-400" />} bg="bg-slate-50" label="الغياب في السنة" value={absences} />
                <StatsCard icon={<Flame className="w-5 h-5 text-red-400" />} bg="bg-red-50" label="أيام الحضور المتتالية" value={streak} />
            </div>

            {/* Badges Section */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-4 h-4 text-[#e6b150]" />
                    <h3 className="font-bold text-sm text-slate-800">شارات الإنجاز</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0a528e] text-white rounded-[16px] p-3 flex flex-col items-center justify-center text-center gap-1">
                        <BookOpen className="w-5 h-5 text-white/80" />
                        <span className="text-xs font-bold mt-1">حافظ سورة البقرة</span>
                    </div>
                    <div className="bg-[#ef4444] text-white rounded-[16px] p-3 flex flex-col items-center justify-center text-center gap-1">
                        <Flame className="w-5 h-5 text-white/80" />
                        <span className="text-xs font-bold mt-1">30 يوم متواصل</span>
                    </div>
                    <div className="bg-[#e6b150] text-white rounded-[16px] p-3 flex flex-col items-center justify-center text-center gap-1">
                        <Star className="w-5 h-5 text-white/80 fill-white/20" />
                        <span className="text-xs font-bold mt-1">متفوق الشهر</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 text-slate-600 rounded-[16px] p-3 flex flex-col items-center justify-center text-center gap-1">
                        <Target className="w-5 h-5 text-rose-400" />
                        <span className="text-[10px] font-bold mt-1">حفظ 5 أجزاء</span>
                    </div>
                </div>
            </div>

            {/* Goal Progress */}
            <div className="bg-[#0a528e] text-white rounded-[24px] p-5 shadow-sm relative overflow-hidden">
                <Star className="w-16 h-16 text-white/5 absolute -top-4 -left-4" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-[#e6b150]" />
                        <h3 className="font-bold text-sm">الهدف الحالي: {currentGoal}</h3>
                    </div>
                    <p className="text-[10px] text-blue-100/80 mb-4 leading-relaxed">
                        أنت على وشك إتمام حفظ سورة الملك! استمر في المراجعة اليومية لتحقيق هدفك بامتياز.
                    </p>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold shrink-0">{goalProgress}%</span>
                        <div className="flex-1 h-1.5 bg-blue-900/50 rounded-full overflow-hidden">
                            <div className="h-full bg-[#e6b150] rounded-full" style={{ width: `${goalProgress}%` }} />
                        </div>
                        <span className="text-[9px] text-blue-200 shrink-0">نسبة الإنجاز</span>
                    </div>
                </div>
            </div>

            {/* Today's Evaluation */}
            <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Star className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-sm text-slate-800">تقييم اليوم</h3>
                </div>
                <div className="space-y-3">
                    <div className="bg-green-50/50 border border-green-100 rounded-[16px] p-3 flex items-center justify-between">
                        <div>
                            <span className="block text-[10px] text-green-600 font-bold mb-1">الحفظ الجديد</span>
                            <span className="text-sm font-black text-green-700">ممتاز</span>
                        </div>
                        <div className="flex gap-1">
                            <Star className="w-4 h-4 fill-green-500 text-green-500" />
                            <Star className="w-4 h-4 fill-green-500 text-green-500" />
                            <Star className="w-4 h-4 fill-green-500 text-green-500" />
                        </div>
                    </div>
                    <div className="bg-primary/5 border border-primary/10 rounded-[16px] p-3 flex items-center justify-between">
                        <div>
                            <span className="block text-[10px] text-primary font-bold mb-1">المراجعة الصغرى</span>
                            <span className="text-sm font-black text-primary">جيد جداً</span>
                        </div>
                        <div className="flex gap-1">
                            <Star className="w-4 h-4 fill-primary text-primary" />
                            <Star className="w-4 h-4 fill-primary text-primary" />
                            <Star className="w-4 h-4 text-primary/30" />
                        </div>
                    </div>
                    <div className="bg-purple-50/50 border border-purple-100 rounded-[16px] p-3 flex items-center justify-between">
                        <div>
                            <span className="block text-[10px] text-purple-600 font-bold mb-1">السلوك والمواظبة</span>
                            <span className="text-sm font-black text-purple-700">ممتاز</span>
                        </div>
                        <div className="flex gap-1">
                            <Star className="w-4 h-4 fill-purple-500 text-purple-500" />
                            <Star className="w-4 h-4 fill-purple-500 text-purple-500" />
                            <Star className="w-4 h-4 fill-purple-500 text-purple-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Weekly Plan Table */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-sm text-slate-800">الخطة الأسبوعية الحالية</h3>
                </div>
                <div className="overflow-x-auto text-center">
                    <table className="w-full text-xs box-content border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="py-2 px-1 text-slate-500 font-medium">اليوم</th>
                                <th className="py-2 px-1 text-slate-500 font-medium">المقرر</th>
                                <th className="py-2 px-1 text-slate-500 font-medium whitespace-nowrap">المستوى</th>
                                <th className="py-2 px-1 text-slate-500 font-medium">المطلوب</th>
                            </tr>
                        </thead>
                        <tbody>
                            {actualPlan.map((plan: any, idx: number) => (
                                <tr key={idx} className="border-b border-slate-50 py-1">
                                    <td className="py-3 px-1 font-bold text-slate-800 whitespace-nowrap">{plan.day}</td>
                                    <td className="py-3 px-1 text-slate-500 whitespace-nowrap">{plan.material}</td>
                                    <td className="py-3 px-1">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${plan.statusColor}`}>
                                            {plan.status}
                                        </span>
                                    </td>
                                    <td className="py-3 px-1 text-slate-500 whitespace-nowrap">{plan.target}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Latest Evaluations */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-sm text-slate-800">آخر التقييمات</h3>
                </div>
                <div className="space-y-3">
                    {actualHistory.map((item: any) => (
                        <div key={item.id} className="border border-slate-100 rounded-[16px] p-3 flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-sm text-slate-800">{item.title}</h4>
                                <p className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap max-w-[140px] leading-relaxed">
                                    {item.date}
                                </p>
                            </div>
                            <span className={`px-3 py-1 rounded-[8px] text-[10px] font-bold shrink-0 ${item.ratingColor}`}>
                                {item.rating}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatsCard({ icon, bg, label, value }: { icon: React.ReactNode, bg: string, label: string, value: string | number }) {
    return (
        <div className="bg-white border border-slate-100 rounded-[20px] p-4 flex flex-col items-center justify-center text-center shadow-sm">
            <div className={`w-10 h-10 ${bg} rounded-full flex items-center justify-center mb-2`}>
                {icon}
            </div>
            <span className="text-[10px] text-slate-500 font-medium mb-1">{label}</span>
            <span className="text-xl font-black text-slate-800">{value}</span>
        </div>
    );
}
