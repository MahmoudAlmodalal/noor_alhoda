"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookMarked, FileText, PlusCircle, User } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { WeeklyPlanModal } from "@/components/plans/WeeklyPlanModal";
import type { Student, StudentCourseStatus, StudentStats, WeeklyPlan } from "@/types/api";

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [planOpen, setPlanOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: student, isLoading: studentLoading } = useApi<Student>(`/api/students/${id}/`);
  const { data: stats } = useApi<StudentStats>(`/api/students/${id}/stats/`);
  const { data: history } = useApi<WeeklyPlan[]>(`/api/students/${id}/history/`);
  const {
    data: studentCourses,
    isLoading: coursesLoading,
    error: coursesError,
    refetch: refetchCourses,
  } = useApi<StudentCourseStatus[]>(`/api/courses/students/${id}/`);

  const toggleCourse = async (courseId: string, next: boolean) => {
    if (!isAdmin || togglingCourseId) return;
    setTogglingCourseId(courseId);
    const res = await api.post(`/api/courses/students/${id}/toggle/`, {
      course_id: courseId,
      is_completed: next,
    });
    setTogglingCourseId(null);
    if (res.success) {
      refetchCourses();
    }
  };

  if (studentLoading && !student) return <PageLoading />;
  if (!student) {
    return (
      <div className="text-center py-12 text-slate-500">لم يتم العثور على الطالب</div>
    );
  }

  const downloadPdf = async () => {
    const blob = await api.downloadBlob(`/api/reports/student/${id}/pdf/`);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير_${student.full_name}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <Link href="/students" className="inline-flex items-center gap-2 text-sm text-primary font-bold hover:underline">
        <ArrowRight className="w-4 h-4 rotate-180" />
        عودة لقائمة الطلاب
      </Link>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{student.full_name}</h1>
            <p className="text-xs text-slate-500 mt-1">{student.national_id}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-blue-50 text-primary text-xs font-bold rounded-md">
                {student.grade}
              </span>

            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <InfoItem label="المحفظ" value={student.teacher_name || "غير معين"} />
          <InfoItem label="ولي الأمر" value={student.guardian_name || "—"} />
          <InfoItem label="الجوال" value={student.mobile || "—"} ltr />
          <InfoItem label="جوال ولي الأمر" value={student.guardian_mobile || "—"} ltr />
          <InfoItem label="الحالة الصحية" value={student.health_status || "—"} />
          <InfoItem label="تاريخ التسجيل" value={student.enrollment_date || "—"} ltr />
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={downloadPdf}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            تحميل التقرير
          </button>
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            إضافة واجب
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setCoursesOpen(true)}
              className="px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 flex items-center gap-2"
            >
              <BookMarked className="w-4 h-4" />
              الدورات التي اجتازها
            </button>
          )}
        </div>
      </div>

      {/* Stats Block */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="نسبة الحضور" value={stats?.attendance_rate != null ? `${stats.attendance_rate}%` : "—"} />
        <StatCard label="الأجزاء المحفوظة" value={stats?.memorized_ajza ?? "—"} />
        <StatCard label="عدد المراجعات" value={stats?.review_count ?? "—"} />
        <StatCard label="المعدل العام" value={stats?.avg_grade ?? "—"} />
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-base text-slate-800">السجل الأسبوعي</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="text-xs text-slate-500 bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 font-bold">الأسبوع</th>
                <th className="px-4 py-3 font-bold">بداية الأسبوع</th>
                <th className="px-4 py-3 font-bold">المطلوب</th>
                <th className="px-4 py-3 font-bold">المنجز</th>
                <th className="px-4 py-3 font-bold">النسبة</th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-slate-400">
                    لا يوجد سجل بعد
                  </td>
                </tr>
              ) : (
                (history ?? []).map((w) => {
                  const rate = w.total_required > 0 ? Math.round((w.total_achieved / w.total_required) * 100) : 0;
                  return (
                    <tr key={w.id} className="border-b border-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-700">#{w.week_number}</td>
                      <td className="px-4 py-3 text-slate-600" dir="ltr">{w.week_start}</td>
                      <td className="px-4 py-3 text-slate-600">{w.total_required}</td>
                      <td className="px-4 py-3 text-slate-600">{w.total_achieved}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                          rate >= 80 ? "bg-green-50 text-green-600" :
                          rate >= 50 ? "bg-orange-50 text-orange-600" :
                          "bg-red-50 text-red-600"
                        }`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Courses Summary (read-only chips) */}
      {(studentCourses ?? []).some((c) => c.is_completed) && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookMarked className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base text-slate-800">الدورات المنجزة</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(studentCourses ?? [])
              .filter((c) => c.is_completed)
              .map((c) => (
                <span
                  key={c.course_id}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg"
                >
                  ✓ {c.course_name}
                </span>
              ))}
          </div>
        </div>
      )}

      <Modal isOpen={coursesOpen} onClose={() => setCoursesOpen(false)} className="max-w-md">
        <div className="flex items-center gap-2 mb-5">
          <BookMarked className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-primary">الدورات التي اجتازها الطالب</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          حدّد الدورات التي أخذها الطالب بالنقر على المربع المقابل لاسم الدورة.
        </p>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {coursesLoading && !studentCourses ? (
            <p className="text-center py-6 text-sm text-slate-400">جارٍ التحميل...</p>
          ) : coursesError ? (
            <p className="text-center py-6 text-sm text-red-500">تعذر تحميل الدورات</p>
          ) : (studentCourses ?? []).length === 0 ? (
            <p className="text-center py-6 text-sm text-slate-400">لا توجد دورات متاحة في النظام</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(studentCourses ?? []).map((c) => {
                const isLoading = togglingCourseId === c.course_id;
                return (
                  <li key={c.course_id} className="py-3">
                    <label
                      className={`flex items-start gap-3 ${
                        !isAdmin || isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={c.is_completed}
                        disabled={!isAdmin || isLoading}
                        onChange={(e) => toggleCourse(c.course_id, e.target.checked)}
                        className="mt-0.5 w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800">{c.course_name}</p>
                        {c.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.description}</p>
                        )}
                        {c.is_completed && c.completion_date && (
                          <p className="text-[11px] text-green-600 mt-1" dir="ltr">
                            ✓ {c.completion_date}
                          </p>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCoursesOpen(false)}
          className="w-full mt-5 h-12 bg-primary text-white font-bold rounded-xl hover:bg-primary/90"
        >
          تم
        </button>
      </Modal>

      <WeeklyPlanModal
        isOpen={planOpen}
        onClose={() => setPlanOpen(false)}
        studentId={student.id}
        studentName={student.full_name}
      />
    </div>
  );
}

function InfoItem({ label, value, ltr }: { label: string; value: string | number; ltr?: boolean }) {
  return (
    <div className="bg-slate-50/80 p-3 rounded-xl">
      <span className="block text-[11px] text-slate-500 font-medium mb-1">{label}</span>
      <span className="block text-sm font-bold text-slate-800" dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
      <p className="text-xs text-slate-500 font-medium mb-2">{label}</p>
      <h3 className="text-2xl font-black text-primary">{value}</h3>
    </div>
  );
}
