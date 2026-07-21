"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
} from "lucide-react";
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
import { StudentHeader } from "@/components/students/StudentHeader";
import { DirectMessageModal } from "@/components/notifications/DirectMessageModal";
import type {
  HistoryEntry,
  StudentCourseStatus,
  StudentStats,
} from "@/types/api";

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [planOpen, setPlanOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
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

      <StudentHeader
        student={student}
        stats={stats}
        isAdmin={isAdmin}
        onDownloadPdf={downloadPdf}
        onOpenPlan={() => setPlanOpen(true)}
        onOpenCourses={isAdmin ? () => setCoursesOpen(true) : undefined}
        onSendMessage={() => setMessageOpen(true)}
      />

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

      {messageOpen ? (
        <DirectMessageModal
          isOpen={messageOpen}
          onClose={() => setMessageOpen(false)}
          studentId={student.id}
          studentName={student.full_name}
          onSent={() => setMessageOpen(false)}
        />
      ) : null}
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
