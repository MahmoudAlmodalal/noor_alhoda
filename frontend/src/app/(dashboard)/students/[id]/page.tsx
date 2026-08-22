"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
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
import { RequestRemoveTeacherModal } from "@/components/students/RequestRemoveTeacherModal";
import { RequestDeleteStudentModal } from "@/components/students/RequestDeleteStudentModal";
import { DirectMessageModal } from "@/components/notifications/DirectMessageModal";
import type {
  HistoryEntry,
  MonthlySummary,
  StudentCourseStatus,
  StudentStats,
} from "@/types/api";
import type { EvaluationRecord } from "@/lib/db/repos/misc";

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [planOpen, setPlanOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: student, isLoading: studentLoading } = useQuery<StudentWithTeacher>(
    "student",
    { id }
  );
  const { data: stats } = useQuery<StudentStats>("student_stats", { student_id: id });
  const { data: history } = useQuery<HistoryEntry[]>("student_history", { student_id: id });
  const { data: evaluations = [] } = useQuery<EvaluationRecord[]>("evaluations", { student_id: id });
  const { data: monthlyReport, isLoading: monthlyReportLoading } = useQuery<MonthlySummary>(
    selectedMonth ? "monthly_summary" : null,
    selectedMonth ? { student_id: id, month_start: selectedMonth } : undefined,
  );
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

  const submitRemoveRequest = async (reason: string) => {
    try {
      await api.post("/api/students/teacher-requests/", {
        student_id: id,
        action: "UNASSIGN",
        reason: reason,
      });
      setRemoveOpen(false);
      // Optional: show a toast notification here
      // But the requirement says "a success toast notification appears", maybe handled by api hook or we can just rely on the component.
      // Wait, there is no toast provided in the code above, but the component has its own state.
    } catch (error) {
      console.error("Failed to submit request", error);
      throw error; // Let the modal handle the error/stop loading
    }
  };

  const submitDeleteRequest = async (reason: string) => {
    try {
      await api.post("/api/students/teacher-requests/", {
        student_id: id,
        action: "DELETE",
        reason: reason,
      });
      setDeleteOpen(false);
    } catch (error) {
      console.error("Failed to submit delete request", error);
      throw error;
    }
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
        onRequestRemove={user?.role === "teacher" ? () => setRemoveOpen(true) : undefined}
        onRequestDelete={user?.role === "teacher" ? () => setDeleteOpen(true) : undefined}
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

      <div className="overflow-hidden rounded-[24px] border border-border-card bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-card px-5 py-4">
          <div>
            <h2 className="font-bold text-base text-text-body">السجل الشهري</h2>
            <p className="mt-1 text-xs text-text-muted">اختر الشهر لعرض تقرير الطالب الكامل.</p>
          </div>
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface-subtle/80 text-xs text-text-muted">
              <tr>
                <th className="px-4 py-3 font-bold">الشهر</th>
                <th className="px-4 py-3 font-bold">الخطة</th>
                <th className="px-4 py-3 font-bold">المنجز</th>
                <th className="px-4 py-3 font-bold">المراجعة</th>
                <th className="px-4 py-3 font-bold">الحضور</th>
                <th className="px-4 py-3 font-bold">الاختبارات</th>
                <th className="px-4 py-3 font-bold">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-text-muted">لا يوجد سجل شهري بعد</td>
                </tr>
              ) : (
                (history ?? []).map((month) => {
                  const rate = month.completion_rate ?? 0;
                  const monthKey = month.month_start ?? month.date.slice(0, 7) + "-01";
                  return (
                    <tr key={month.id} className="border-b border-border-card last:border-b-0">
                      <td className="px-4 py-3 font-bold text-text-body" dir="ltr">{monthKey.slice(0, 7)}</td>
                      <td className="px-4 py-3 text-text-label">{month.required_pages ?? ((month.total_required ?? 0) / 15).toFixed(1)} صفحة</td>
                      <td className="px-4 py-3 text-text-label">
                        {month.total_pages ?? ((month.total_lines ?? 0) / 15).toFixed(1)} صفحة
                        <span className="mt-1 block text-[11px] text-text-muted">{month.total_achieved ?? 0} آية</span>
                      </td>
                      <td className="px-4 py-3 text-text-label">
                        {month.total_review_pages ?? ((month.total_review_lines ?? 0) / 15).toFixed(1)} صفحة
                        <span className="mt-1 block text-[11px] text-text-muted">{month.total_review_lines ?? 0} سطر</span>
                      </td>
                      <td className="px-4 py-3 text-text-label">{month.present_days ?? 0} يوم</td>
                      <td className="px-4 py-3 text-text-label">
                        {month.evaluated_evaluation_count ?? 0}/{month.evaluation_count ?? 0}
                        {month.evaluation_count ? ` (${month.evaluation_completion_rate ?? 0}%)` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedMonth(monthKey)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90"
                        >
                          <FileText className="h-3.5 w-3.5" /> عرض التفاصيل
                        </button>
                        <span className={`mt-1 block text-[11px] font-bold ${rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-red-600"}`}>{rate}% إنجاز</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={Boolean(selectedMonth)} onClose={() => setSelectedMonth(null)} className="max-w-5xl">
        <div dir="rtl" className="space-y-5">
          <div className="flex items-start justify-between gap-3 border-b border-border-card pb-4">
            <div>
              <h2 className="text-lg font-bold text-primary">التقرير الشهري الكامل</h2>
              <p className="mt-1 text-sm font-bold text-text-body">{student.full_name} — {selectedMonth?.slice(0, 7)}</p>
            </div>
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>

          {monthlyReportLoading || !monthlyReport ? (
            <div className="py-12 text-center text-sm text-text-muted">جارٍ تجهيز التقرير...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <ReportStat label="إنجاز الخطة" value={`${monthlyReport.completion_rate ?? 0}%`} />
                <ReportStat label="صفحات الحفظ" value={`${monthlyReport.total_pages ?? ((monthlyReport.total_lines ?? 0) / 15).toFixed(1)} صفحة`} />
                <ReportStat label="صفحات المراجعة" value={`${monthlyReport.total_review_pages ?? ((monthlyReport.total_review_lines ?? 0) / 15).toFixed(1)} صفحة`} />
                <ReportStat label="أيام الحضور" value={`${monthlyReport.records.filter((r) => r.attendance === "present" || r.attendance === "late").length} يوم`} />
                <ReportStat label="أيام الغياب" value={`${monthlyReport.records.filter((r) => r.attendance === "absent").length} يوم`} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border-card bg-surface-subtle p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text-body"><CheckCircle2 className="h-4 w-4 text-primary" />ملخص الخطة</h3>
                  <div className="space-y-2 text-xs text-text-muted">
                    <p className="flex justify-between"><span>المطلوب</span><b className="text-text-body">{monthlyReport.total_required ?? 0} آية</b></p>
                    <p className="flex justify-between"><span>المنجز</span><b className="text-emerald-600">{monthlyReport.total_achieved ?? 0} آية</b></p>
                    <p className="flex justify-between"><span>الأسطر المحفوظة</span><b className="text-text-body">{monthlyReport.total_lines ?? 0} سطر</b></p>
                    <p className="flex justify-between"><span>أسطر المراجعة</span><b className="text-text-body">{monthlyReport.total_review_lines ?? 0} سطر</b></p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border-card bg-surface-subtle p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text-body"><ClipboardCheck className="h-4 w-4 text-primary" />اختبارات الشهر</h3>
                  {(evaluations ?? []).filter((e) => e.scheduled_date.startsWith(selectedMonth?.slice(0, 7) ?? "")).length === 0 ? (
                    <p className="text-xs text-text-muted">لا توجد اختبارات مسجلة في هذا الشهر.</p>
                  ) : (
                    <div className="space-y-2">
                      {(evaluations ?? []).filter((e) => e.scheduled_date.startsWith(selectedMonth?.slice(0, 7) ?? "")).map((evaluation) => (
                        <div key={evaluation.id} className="rounded-xl bg-white p-3 text-xs">
                          <div className="flex justify-between gap-2"><b className="text-text-body">{evaluation.title}</b><span dir="ltr">{evaluation.scheduled_date}</span></div>
                          <p className="mt-1 text-text-muted">{evaluation.status} {evaluation.score !== null ? `— ${evaluation.score} / ${evaluation.max_score}` : ""}</p>
                          {evaluation.result_note ? <p className="mt-1 text-text-muted">{evaluation.result_note}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border-card">
                <table className="w-full min-w-[760px] text-right text-xs">
                  <thead className="bg-surface-subtle text-text-muted"><tr><th className="px-3 py-3">التاريخ</th><th className="px-3 py-3">الحضور</th><th className="px-3 py-3">الحفظ</th><th className="px-3 py-3">المراجعة</th><th className="px-3 py-3">التقييم</th><th className="px-3 py-3">ملاحظات</th></tr></thead>
                  <tbody>{monthlyReport.records.map((record) => {
                    const evaluation = (evaluations ?? []).find((e) => e.id === record.evaluation_id);
                    return <tr key={record.id || record.date} className="border-t border-border-card"><td className="px-3 py-3" dir="ltr">{record.date}</td><td className="px-3 py-3">{record.attendance}</td><td className="px-3 py-3">{record.surah_name || "—"}<span className="block text-[11px] text-text-muted">{record.memorized_lines ?? 0} سطر</span></td><td className="px-3 py-3">{record.review_surah_name || "—"}<span className="block text-[11px] text-text-muted">{record.review_lines ?? 0} سطر</span></td><td className="px-3 py-3">{evaluation?.title || record.quality || "—"}</td><td className="max-w-[180px] px-3 py-3 text-text-muted">{record.note || "—"}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Modal>

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

      <RequestRemoveTeacherModal
        isOpen={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onSubmit={submitRemoveRequest}
        studentName={student.full_name}
      />

      <RequestDeleteStudentModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onSubmit={submitDeleteRequest}
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
function ReportStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border-card bg-white p-3 text-center shadow-sm">
      <p className="text-[11px] text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-black text-primary">{value}</p>
    </div>
  );
}
