"use client";

import { Card, CardContent } from "@/components/ui/Card";
import {
  Users,
  CheckCircle2,
  Clock,
  Star,
  Calendar,
  Search,
  MoreVertical,
  PlusCircle,
  MessageSquare,
  ClipboardCheck,
  Filter,
  BookOpen,
  UserPlus,
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
    isTeacher && user?.id ? "/api/students/" : null,
    isTeacher && user?.id ? { teacher_id: user.id } : undefined
  );
  const { data: todayRecords } = useApi<DailyRecord[]>(
    isTeacher ? "/api/records/" : null,
    isTeacher ? { date: todayKey() } : undefined
  );

  // Roster table — admin sees all, teacher sees own
  const rosterParams = useMemo(() => {
    const p: Record<string, string | undefined> = { search: debouncedSearch };
    if (isTeacher && user?.id) p.teacher_id = user.id;
    return p;
  }, [debouncedSearch, isTeacher, user?.id]);
  const { data: rosterData, isLoading: rosterLoading, refetch: refetchRoster } = useApi<Student[]>(
    "/api/students/"
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
        late: dashStats.late ?? 0,
        outstanding: dashStats.outstanding ?? 0,
      };
    }
    if (isTeacher) {
      const list = teacherStudents ?? [];
      const records = todayRecords ?? [];
      return {
        totalStudents: list.length,
        attendanceToday: records.filter((r) => r.attendance === "present").length,
        late: records.filter((r) => r.attendance === "late").length,
        outstanding: records.filter((r) => r.quality === "excellent").length,
      };
    }
    return { totalStudents: 0, attendanceToday: 0, late: 0, outstanding: 0 };
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
            <h2 className="text-4xl font-bold text-secondary">{stats.late}</h2>
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
                    <h4 className="font-bold text-sm text-slate-800">{student.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{student.subtitle}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${student.badgeColor}`}>
                    {student.badge}
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/students"
            className="block w-full mt-4 py-2 bg-blue-50 text-primary rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors text-center"
          >
            عرض كل الطلاب
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Primary action: Register student */}
        <Link
          href="/students/register"
          className="relative overflow-hidden bg-primary rounded-2xl p-5 flex flex-col gap-2 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1)] hover:bg-primary/90 transition-colors"
        >
          <div className="absolute w-32 h-32 rounded-full bg-white/10 -top-16 -start-16" />
          <UserPlus className="w-7 h-7 text-white relative z-10" />
          <h4 className="font-bold text-lg text-white relative z-10">تسجيل طالب جديد</h4>
          <p className="text-xs text-white/80 relative z-10">إضافة طالب جديد إلى المركز</p>
        </Link>

        {/* Secondary action: Add ring */}
        <Link
          href="/rings"
          className="relative overflow-hidden bg-secondary rounded-2xl p-5 flex flex-col gap-2 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1)] hover:bg-secondary/90 transition-colors"
        >
          <div className="absolute w-32 h-32 rounded-full bg-white/10 -top-16 -start-16" />
          <BookOpen className="w-7 h-7 text-white relative z-10" />
          <h4 className="font-bold text-lg text-white relative z-10">إضافة حلقة</h4>
          <p className="text-xs text-white/80 relative z-10">إضافة حلقة وشيخ</p>
        </Link>

        {/* Tertiary actions stacked */}
        <div className="flex flex-col gap-3">
          <Link href="/attendance" className="bg-white border border-[#f3f4f6] rounded-[14px] p-4 flex items-center gap-3 shadow-sm hover:border-primary/30 transition-colors">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <div>
              <h4 className="font-bold text-sm text-[#2d2d2d]">تسجيل الحضور</h4>
              <p className="text-[10px] text-[#818181]">حفظ غياب وحضور اليوم</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setAnnounceModalOpen(true)}
            disabled={!isAdmin}
            className="bg-white border border-[#f3f4f6] rounded-[14px] p-4 flex items-center gap-3 shadow-sm hover:border-primary/30 transition-colors text-start disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageSquare className="w-5 h-5 text-primary" />
            <div>
              <h4 className="font-bold text-sm text-[#2d2d2d]">إرسال رسالة</h4>
              <p className="text-[10px] text-[#818181]">مراسلة أولياء الأمور</p>
            </div>
          </button>
        </div>
      </div>

      {/* Roster Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h3 className="font-bold text-lg text-slate-800">سجل طلاب الحلقة</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث عن اسم الطالب..."
                className="pl-4 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="text-xs text-slate-500 bg-slate-50/80 uppercase">
              <tr>
                <th className="px-4 py-3 rounded-s-xl font-bold">اسم الطالب</th>
                <th className="px-4 py-3 font-bold">الصف</th>
                <th className="px-4 py-3 font-bold">المحفظ</th>
                <th className="px-4 py-3 font-bold">الحالة</th>
                <th className="px-4 py-3 rounded-e-xl text-center font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rosterLoading && rosterStudents.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-slate-400">جاري التحميل...</td></tr>
              ) : rosterStudents.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-slate-400">لا توجد نتائج</td></tr>
              ) : (
                rosterStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/students/${student.id}`)}
                  >
                    <td className="px-4 py-4 font-bold text-slate-800">{student.full_name}</td>
                    <td className="px-4 py-4 text-slate-600">{student.grade}</td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                        {student.teacher_name || "غير معين"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {student.is_active ? (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">منتظم</span>
                      ) : (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">منقطع</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-primary transition-colors p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/students/${student.id}`);
                        }}
                      >
                        <MoreVertical className="w-5 h-5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex justify-center mt-6">
            <Link
              href="/students"
              className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors"
            >
              عرض المزيد
            </Link>
          </div>
        </div>
      </div>

      <WeeklyPlanModal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
      />
      {isAdmin && (
        <AnnounceModal
          isOpen={announceModalOpen}
          onClose={() => setAnnounceModalOpen(false)}
        />
      )}
    </div>
  );
}
