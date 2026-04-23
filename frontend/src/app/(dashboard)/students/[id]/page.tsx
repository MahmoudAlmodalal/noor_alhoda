"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  FileText,
  PlusCircle,
  UserCog,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  AttendancePill,
  type AttendanceValue,
} from "@/components/ui/AttendancePill";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import { useQuery } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useMutation";
import type { StudentWithTeacher } from "@/hooks/queries";
import { api } from "@/lib/api";
import { getDb } from "@/lib/db/schema";
import { decryptRow } from "@/lib/db/repos/index";
import type { StudentCourseRecord } from "@/lib/db/repos/misc";
import { useAuth } from "@/contexts/AuthContext";
import { WeeklyPlanModal } from "@/components/plans/WeeklyPlanModal";
import type {
  HistoryEntry,
  StudentCourseStatus,
  StudentStats,
} from "@/types/api";

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [planOpen, setPlanOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: student, isLoading: studentLoading } = useQuery<StudentWithTeacher>(
    "student",
    { id }
  );
  const { data: stats } = useQuery<StudentStats>("student_stats", { student_id: id });
  const { data: history } = useQuery<HistoryEntry[]>("student_history", { student_id: id });
  const {
    data: studentCourses,
    isLoading: coursesLoading,
    error: coursesError,
  } = useQuery<StudentCourseStatus[]>("student_courses", { student_id: id });

  const createSc = useMutation("student_course", "create");
  const updateSc = useMutation("student_course", "update");

  const toggleCourse = async (courseId: string, next: boolean) => {
    if (!isAdmin || togglingCourseId) return;
    setTogglingCourseId(courseId);
    try {
      // Find existing local row by (student_id, course_id) without decrypting
      // the whole table — student_id and course_id are cleartext indexes.
      const rows = await getDb()
        .student_courses.where("student_id")
        .equals(id)
        .and((r) => r.course_id === courseId)
        .toArray();
      if (rows.length > 0) {
        const existing = await decryptRow<StudentCourseRecord>(rows[0]);
        await updateSc.mutate(
          {
            id: existing.id,
            is_completed: next,
            completion_date: next
              ? (existing.completion_date ?? new Date().toISOString().slice(0, 10))
              : null,
          },
          { silent: true }
        );
      } else {
        await createSc.mutate(
          {
            student_id: id,
            course_id: courseId,
            is_completed: next,
            completion_date: next ? new Date().toISOString().slice(0, 10) : null,
          },
          { silent: true }
        );
      }
    } finally {
      setTogglingCourseId(null);
    }
  };

  if (studentLoading && !student) return <PageLoading />;
  if (!student) {
    return (
      <div className="text-center py-12 text-text-muted">لم يتم العثور على الطالب</div>
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

      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-primary via-[#0a4a85] to-[#083d73] p-6 text-white shadow-[0_10px_30px_-12px_rgba(11,83,148,0.45)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1.5px, transparent 2px), radial-gradient(circle at 70% 60%, white 1.5px, transparent 2px), radial-gradient(circle at 40% 85%, white 1.5px, transparent 2px)",
            backgroundSize: "80px 80px, 140px 140px, 100px 100px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -start-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -end-10 h-64 w-64 rounded-full bg-[#eabd5b]/15 blur-3xl"
        />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
          <div className="shrink-0">
            <Avatar name={student.full_name} size={88} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-2xl font-black leading-tight text-white">
              {student.full_name}
            </h1>
            <p className="text-xs text-white/70" dir="ltr">
              {student.national_id}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm">
                الصف {student.grade || "—"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm">
                <UserCog className="h-3 w-3" />
                {student.teacher_name || "غير مسنَد"}
              </span>
              {stats?.today_record?.attendance ? (
                <AttendancePill
                  value={stats.today_record.attendance as AttendanceValue}
                  className="bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-sm"
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-white/15 pt-4">
          <button
            type="button"
            onClick={downloadPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <FileText className="h-4 w-4" />
            تحميل التقرير
          </button>
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-white/90"
          >
            <PlusCircle className="h-4 w-4" />
            إضافة واجب
          </button>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setCoursesOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#eabd5b] px-4 py-2 text-xs font-bold text-[#5c4a20] transition-colors hover:bg-[#eabd5b]/90"
            >
              <BookMarked className="h-4 w-4" />
              الدورات التي اجتازها
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-[24px] border border-border-card bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-text-title">
          المعلومات الشخصية
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InfoItem label="ولي الأمر" value={student.guardian_name || "—"} />
          <InfoItem label="الجوال" value={student.mobile || "—"} ltr />
          <InfoItem
            label="جوال ولي الأمر"
            value={student.guardian_mobile || "—"}
            ltr
          />
          <InfoItem
            label="الحالة الصحية"
            value={student.health_status || "—"}
          />
          <InfoItem
            label="تاريخ التسجيل"
            value={student.enrollment_date || "—"}
            ltr
          />
          <InfoItem label="العنوان" value={student.address || "—"} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="نسبة الحضور" value={stats?.attendance_rate != null ? `${stats.attendance_rate}%` : "—"} />
        <StatCard label="الأجزاء المحفوظة" value={stats?.memorized_ajza ?? "—"} />
        <StatCard label="عدد المراجعات" value={stats?.review_count ?? "—"} />
        <StatCard label="المعدل العام" value={stats?.avg_grade ?? "—"} />
      </div>

      <div className="bg-white rounded-[24px] shadow-sm border border-border-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border-card">
          <h2 className="font-bold text-base text-text-body">السجل الأسبوعي</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="text-xs text-text-muted bg-surface-subtle/80">
              <tr>
                <th className="px-4 py-3 font-bold">بداية الأسبوع</th>
                <th className="px-4 py-3 font-bold">المطلوب</th>
                <th className="px-4 py-3 font-bold">المنجز</th>
                <th className="px-4 py-3 font-bold">النسبة</th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-sm text-text-muted">
                    لا يوجد سجل بعد
                  </td>
                </tr>
              ) : (
                (history ?? []).map((w) => {
                  const required = w.required_verses ?? 0;
                  const achieved = w.achieved_verses ?? 0;
                  const rate = required > 0 ? Math.round((achieved / required) * 100) : 0;
                  return (
                    <tr key={w.id} className="border-b border-border-card">
                      <td className="px-4 py-3 text-text-label" dir="ltr">{w.date}</td>
                      <td className="px-4 py-3 text-text-label">{required}</td>
                      <td className="px-4 py-3 text-text-label">{achieved}</td>
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

      {(studentCourses ?? []).some((c) => c.is_completed) && (
        <div className="bg-white rounded-[24px] shadow-sm border border-border-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookMarked className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base text-text-body">الدورات المنجزة</h2>
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
        <p className="text-xs text-text-muted mb-4">
          حدّد الدورات التي أخذها الطالب بالنقر على المربع المقابل لاسم الدورة.
        </p>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {coursesLoading && !studentCourses ? (
            <p className="text-center py-6 text-sm text-text-muted">جارٍ التحميل...</p>
          ) : coursesError ? (
            <p className="text-center py-6 text-sm text-red-500">تعذر تحميل الدورات</p>
          ) : (studentCourses ?? []).length === 0 ? (
            <p className="text-center py-6 text-sm text-text-muted">لا توجد دورات متاحة في النظام</p>
          ) : (
            <ul className="divide-y divide-border-card">
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
                        className="mt-0.5 w-5 h-5 rounded border-border-subtle text-primary focus:ring-primary/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-text-body">{c.course_name}</p>
                        {c.description && (
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{c.description}</p>
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
    <div className="bg-surface-subtle/80 p-3 rounded-xl">
      <span className="block text-[11px] text-text-muted font-medium mb-1">{label}</span>
      <span className="block text-sm font-bold text-text-body" dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-[24px] p-5 border border-border-card shadow-sm text-center">
      <p className="text-xs text-text-muted font-medium mb-2">{label}</p>
      <h3 className="text-2xl font-black text-primary">{value}</h3>
    </div>
  );
}
