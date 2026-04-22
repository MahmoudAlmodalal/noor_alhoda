"use client";

import { StatTile } from "@/components/ui/StatTile";
import {
  Users,
  CheckCircle2,
  Star,
  Calendar,
  BookOpen,
  Clock,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useEffect, useState } from "react";
import { useQuery } from "@/hooks/useApi";
import type {
  DailyRecordRecord,
  StudentWithTeacher,
} from "@/hooks/queries";
import type { DashboardStats, ScheduleItem } from "@/types/api";
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
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [announceModalOpen, setAnnounceModalOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";
  const teacherProfileId = user?.teacher_profile?.id;

  useEffect(() => {
    if (!authLoading && isStudent) {
      router.replace("/student");
    }
  }, [authLoading, isStudent, router]);

  const { data: dashStats, isLoading: dashLoading } = useQuery<DashboardStats>(
    isAdmin ? "dashboard_stats" : null
  );

  const { data: teacherStudents } = useQuery<StudentWithTeacher[]>(
    isTeacher && teacherProfileId ? "students_with_teacher" : null,
    isTeacher && teacherProfileId ? { teacher_id: teacherProfileId } : undefined
  );
  const { data: todayRecords } = useQuery<DailyRecordRecord[]>(
    isTeacher ? "daily_records" : null,
    isTeacher ? { date: todayKey() } : undefined
  );

  const { data: rosterData, isLoading: rosterLoading } = useQuery<StudentWithTeacher[]>(
    isAdmin || isTeacher ? "students_with_teacher" : null,
    isTeacher && teacherProfileId ? { teacher_id: teacherProfileId } : undefined
  );

  if (authLoading) return <PageLoading />;
  if (isStudent) return <PageLoading />;
  if (isAdmin && dashLoading && !dashStats) return <PageLoading />;

  const stats = (() => {
    if (isAdmin && dashStats) {
      return {
        totalStudents: dashStats.total_students,
        attendanceToday: dashStats.today.present,
        ringsCount: dashStats.total_teachers,
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
        outstanding: records.filter((r) => r.attendance === "absent").length,
      };
    }
    return { totalStudents: 0, attendanceToday: 0, ringsCount: 0, outstanding: 0 };
  })();

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

  const followUpStudents = (rosterData ?? [])
    .filter((s) => !s.teacher_name)
    .slice(0, 3)
    .map((s) => ({
      id: s.id,
      name: s.full_name,
      subtitle: s.grade || "بدون محفظ",
      badge: s.grade || "تنبيه",
      badgeColor: "text-primary bg-blue-50 border border-primary/20",
      avatar: s.full_name?.[0] ?? "؟",
    }));

  const rosterStudents = (rosterData ?? []).slice(0, 8);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="bg-white rounded-2xl p-6 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)] border border-[#f3f4f6] flex flex-col items-center text-center">
        <h1 className="text-2xl font-bold text-primary mb-1">
          {isTeacher ? "مرحباً، الشيخ " : "مرحباً، "}{user?.full_name || ""}
        </h1>
        <p className="text-sm text-[#818181] mb-4">
          {isTeacher
            ? "خيركم من تعلم القرآن وعلّمه"
            : "نسأل الله لك التوفيق في إدارة هذه المؤسسة المباركة"}
        </p>
        {isTeacher ? (
          user?.teacher_profile?.specialization && (
            <div className="inline-flex items-center gap-2 border border-secondary/50 bg-[rgba(251,242,222,0.6)] px-4 py-2 rounded-[10px]">
              <Star className="w-4 h-4 text-secondary fill-secondary" />
              <span className="text-sm font-bold text-primary">{user.teacher_profile.specialization}</span>
            </div>
          )
        ) : (
          <div className="inline-flex items-center gap-3 border border-secondary/50 bg-[rgba(251,242,222,0.6)] px-4 py-2 rounded-[10px]">
            <div className="flex flex-col text-right">
              <span className="text-xs text-[#818181] font-normal">العام الدراسي الحالي</span>
              <span className="text-base font-bold text-primary">1447هـ - 2026م</span>
            </div>
            <Calendar className="w-6 h-6 text-secondary" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<Users className="h-6 w-6 text-primary" />}
          tileBg="blue"
          label={isTeacher ? "طلاب الحلقة" : "عدد الطلاب المسجلين"}
          value={stats.totalStudents}
        />
        <StatTile
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />}
          tileBg="green"
          label="الحضور اليوم"
          value={stats.attendanceToday}
          valueClassName="text-[30px] font-bold leading-9 text-emerald-600"
        />
        <StatTile
          icon={
            isTeacher ? (
              <Clock className="h-6 w-6 text-amber-600" />
            ) : (
              <BookOpen className="h-6 w-6 text-secondary" />
            )
          }
          tileBg={isTeacher ? "yellow" : "amber"}
          label={isTeacher ? "المتأخرين" : "عدد الحلقات"}
          value={stats.ringsCount}
          valueClassName={`text-[30px] font-bold leading-9 ${isTeacher ? "text-amber-600" : "text-secondary"}`}
        />
        <StatTile
          icon={
            isTeacher ? (
              <UserX className="h-6 w-6 text-pink-600" />
            ) : (
              <Star className="h-6 w-6 fill-secondary text-secondary" />
            )
          }
          tileBg={isTeacher ? "red" : "blue"}
          label={isTeacher ? "المتغيبون" : "الحفظة المتقنون"}
          value={stats.outstanding}
          valueClassName={`text-[30px] font-bold leading-9 ${isTeacher ? "text-pink-600" : "text-primary"}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                href="/students/register"
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
