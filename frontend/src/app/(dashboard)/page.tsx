"use client";

import { Card, CardContent } from "@/components/ui/Card";
import {
  Users,
  CheckCircle2,
  Star,
  Calendar,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import type {
  DashboardStats,
  Student,
  DailyRecord,
  ScheduleItem,
} from "@/types/api";
import { WeeklyPlanModal } from "@/components/plans/WeeklyPlanModal";
import { AnnounceModal } from "@/components/notifications/AnnounceModal";

const HIJRI_PLACEHOLDER = "اليوم";

const SESSION_DAY_LABELS: Record<string, string> = {
  sat: "السبت",
  sun: "الأحد",
  mon: "الاثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayWeekday(): string {
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[new Date().getDay()];
}

export default function Dashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [announceModalOpen, setAnnounceModalOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";

  // For teachers, we need their profile ID, not their user ID
  const teacherProfileId = user?.teacher_profile?.id;

  useEffect(() => {
    if (!authLoading && isStudent) {
      router.replace("/student");
    }
  }, [authLoading, isStudent, router]);

  // Admin: live dashboard stats
  const { data: dashStats, isLoading: dashLoading } = useApi<DashboardStats>(
    isAdmin ? "/api/reports/dashboard/" : null
  );

  // Teacher fallback: list own students + today's records
  const { data: teacherStudents } = useApi<Student[]>(
    isTeacher && teacherProfileId ? "/api/students/" : null,
    isTeacher && teacherProfileId ? { teacher_id: teacherProfileId } : undefined
  );
  const { data: todayRecords } = useApi<DailyRecord[]>(
    isTeacher ? "/api/records/" : null,
    isTeacher ? { date: todayKey() } : undefined
  );

  // Roster table — admin sees all, teacher sees own
  const rosterParams = useMemo(() => {
    const p: Record<string, string | undefined> = { search: debouncedSearch };
    if (isTeacher && teacherProfileId) p.teacher_id = teacherProfileId;
    return p;
  }, [debouncedSearch, isTeacher, teacherProfileId]);

  const { data: rosterData, isLoading: rosterLoading, refetch: refetchRoster } = useApi<Student[]>(
    isAdmin || isTeacher ? "/api/students/" : null
  );
  useEffect(() => {
    refetchRoster(rosterParams);
  }, [rosterParams, refetchRoster]);

  if (authLoading) return <PageLoading />;
  if (isStudent) return <PageLoading />;
  if (isAdmin && dashLoading && !dashStats) return <PageLoading />;

  // ─── Derived stats ─────────────────────────────────────────────────────────
  const stats = (() => {
    if (isAdmin && dashStats) {
      return {
        totalStudents: dashStats.total_students,
        attendanceToday: dashStats.today.present,
        ringsCount: dashStats.rings_count,
        outstanding: dashStats.outstanding_count,
      };
    }
    if (isTeacher) {
      const list = teacherStudents ?? [];
      const records = todayRecords ?? [];
      return {
        totalStudents: list.length,
        attendanceToday: records.filter((r) => r.attendance === "present").length,
        ringsCount: records.filter((r) => r.attendance === "late").length,
        outstanding: records.filter((r) => r.quality === "excellent").length,
      };
    }
    return { totalStudents: 0, attendanceToday: 0, ringsCount: 0, outstanding: 0 };
  })();

  // ─── Schedule (derived from teacher session_days; backend has no endpoint) ─
  const schedule: ScheduleItem[] = (() => {
    const today = todayWeekday();
    const todayLabel = SESSION_DAY_LABELS[today];
    return [
      {
        id: "morning",
        title: "حلقة الفجر (مراجعة وتثبيت)",
        time: "من بعد صلاة الفجر إلى الإشراق",
        active: true,
        actionText: "بدء الحلقة",
      },
      {
        id: "afternoon",
        title: `حلقة العصر (${todayLabel})`,
        time: "من صلاة العصر إلى المغرب",
        active: false,
        actionText: "تجهيز الحلقة",
      },
    ];
  })();

  // ─── Follow-up students (best-effort: inactive or no teacher) ──────────────
  const followUpStudents = (rosterData ?? [])
    .filter((s) => !s.is_active || !s.teacher_name)
    .slice(0, 3)
    .map((s) => ({
      id: s.id,
      name: s.full_name,
      subtitle: !s.is_active ? "متوقف" : "بدون محفظ",
      badge: !s.is_active ? "إنذار" : "تنبيه",
      badgeColor: "text-slate-600 bg-slate-100",
      avatar: s.full_name?.[0] ?? "؟",
    }));

  const rosterStudents = (rosterData ?? []).slice(0, 8);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Top Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)] border border-[#f3f4f6] flex flex-col items-center text-center">
        <h1 className="text-2xl font-bold text-primary mb-1">
          مرحباً، {user?.full_name || ""}
        </h1>
        <p className="text-sm text-[#818181] mb-4">
          نسأل الله لك التوفيق في إدارة هذه المؤسسة المباركة
        </p>
        <div className="inline-flex items-center gap-3 border border-secondary/50 bg-[rgba(251,242,222,0.6)] px-4 py-2 rounded-[10px]">
          <div className="flex flex-col text-right">
            <span className="text-xs text-[#818181] font-normal">العام الدراسي الحالي</span>
            <span className="text-base font-bold text-primary">1447هـ - 2026م</span>
          </div>
          <Calendar className="w-6 h-6 text-secondary" />
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex flex-col items-start gap-3">
            <div className="w-14 h-14 bg-[#ceddea] rounded-full flex items-center justify-center shadow-[0px_2px_4px_0px_rgba(0,0,0,0.1)]">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm text-[#818181] font-medium">عدد الطلاب المسجلين</p>
            <h2 className="text-4xl font-bold text-primary">{stats.totalStudents}</h2>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex flex-col items-start gap-3">
            <div className="w-14 h-14 bg-[#ceddea] rounded-full flex items-center justify-center shadow-[0px_2px_4px_0px_rgba(0,0,0,0.1)]">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm text-[#818181] font-medium">الحضور اليوم</p>
            <h2 className="text-4xl font-bold text-primary">{stats.attendanceToday}</h2>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex flex-col items-start gap-3">
            <div className="w-14 h-14 bg-[#fbf2de] rounded-full flex items-center justify-center shadow-[0px_2px_4px_0px_rgba(0,0,0,0.1)]">
              <BookOpen className="w-7 h-7 text-secondary" />
            </div>
            <p className="text-sm text-[#818181] font-medium">عدد الحلقات</p>
            <h2 className="text-4xl font-bold text-secondary">{stats.ringsCount}</h2>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex flex-col items-start gap-3">
            <div className="w-14 h-14 bg-[#ceddea] rounded-full flex items-center justify-center shadow-[0px_2px_4px_0px_rgba(0,0,0,0.1)]">
              <Star className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm text-[#818181] font-medium">الحفظة المتقنون</p>
            <h2 className="text-4xl font-bold text-primary">{stats.outstanding}</h2>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Calendar className="w-5 h-5 text-secondary" />
            <h3 className="font-bold text-lg text-slate-800">جدول اليوم</h3>
            <span className="ms-auto text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-600 font-medium">{HIJRI_PLACEHOLDER}</span>
          </div>

          <div className="space-y-3">
            {schedule.map((session) => (
              <div key={session.id} className={`p-4 rounded-xl border flex items-center justify-between ${session.active ? 'border-primary/20 bg-[#f8fbff]' : 'border-slate-100'}`}>
                <div>
                  <h4 className={`font-bold text-sm ${session.active ? 'text-primary' : 'text-slate-700'}`}>{session.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{session.time}</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/attendance")}
                  className={`text-xs px-4 py-2 font-bold rounded-lg shrink-0 ${session.active ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}
                >
                  {session.actionText}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Follow up students */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg text-slate-800">طلاب يحتاجون متابعة</h3>
          </div>

          <div className="space-y-3">
            {followUpStudents.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">لا يوجد طلاب بحاجة لمتابعة</p>
            ) : (
              followUpStudents.map((student) => (
                <Link
                  key={student.id}
                  href={`/students/${student.id}`}
                  className="p-3 rounded-xl border border-slate-100 flex items-center gap-3 hover:border-primary/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-blue-50 text-primary font-bold rounded-full flex items-center justify-center shrink-0">
                    {student.avatar}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800">{student.name}</h4>
                    <p className="text-xs text-slate-500">{student.subtitle}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${student.badgeColor}`}>
                    {student.badge}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions & Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">قائمة الطلاب</h3>
              <Link href="/students" className="text-xs text-primary font-bold hover:underline">عرض الكل</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold">
                  <tr>
                    <th className="px-5 py-3">الطالب</th>
                    <th className="px-5 py-3">الحلقة</th>
                    <th className="px-5 py-3">الحالة</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rosterLoading ? (
                    <tr><td colSpan={4} className="py-10 text-center text-slate-400 text-xs">جاري التحميل...</td></tr>
                  ) : rosterStudents.length === 0 ? (
                    <tr><td colSpan={4} className="py-10 text-center text-slate-400 text-xs">لا يوجد طلاب مسجلين</td></tr>
                  ) : (
                    rosterStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                              {s.full_name?.[0]}
                            </div>
                            <span className="text-sm font-bold text-slate-700">{s.full_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600">{s.teacher_name || "غير محدد"}</td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.is_active ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                            {s.is_active ? 'نشط' : 'متوقف'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-left">
                          <Link href={`/students/${s.id}`} className="text-primary hover:text-primary/80">
                            <Star className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-primary rounded-2xl p-6 text-white shadow-lg shadow-primary/20">
            <h3 className="font-bold text-lg mb-2">إجراءات سريعة</h3>
            <p className="text-xs text-white/70 mb-6 leading-relaxed">استخدم هذه الاختصارات للوصول السريع لأهم المهام اليومية</p>
            
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setPlanModalOpen(true)}
                className="flex items-center gap-3 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors text-right"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">خطة أسبوعية</h4>
                  <p className="text-[10px] text-white/60">توزيع الحفظ والمراجعة</p>
                </div>
              </button>

              <button
                onClick={() => setAnnounceModalOpen(true)}
                className="flex items-center gap-3 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors text-right"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">إعلان عام</h4>
                  <p className="text-[10px] text-white/60">إرسال تنبيه لجميع الطلاب</p>
                </div>
              </button>

              <Link
                href="/students/new"
                className="flex items-center gap-3 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors text-right"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">تسجيل طالب</h4>
                  <p className="text-[10px] text-white/60">إضافة طالب جديد للنظام</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <WeeklyPlanModal isOpen={planModalOpen} onClose={() => setPlanModalOpen(false)} />
      <AnnounceModal isOpen={announceModalOpen} onClose={() => setAnnounceModalOpen(false)} />
    </div>
  );
}
