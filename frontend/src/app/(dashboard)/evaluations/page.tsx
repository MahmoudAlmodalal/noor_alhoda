"use client";

import { useMemo, useState } from "react";
import { CalendarDays, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { EvaluationCreateModal } from "@/components/modals/EvaluationCreateModal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "@/hooks/useMutation";
import { useQuery } from "@/hooks/useApi";
import type { EvaluationForTeacher } from "@/lib/db/repos/aggregates";
import { cn } from "@/lib/utils";

type Tab = "upcoming" | "completed" | "all";

const tabs: Array<{ key: Tab; label: string }> = [
  { key: "upcoming", label: "القادمة" },
  { key: "completed", label: "المنتهية" },
  { key: "all", label: "الكل" },
];

function statusLabel(status: string): string {
  switch (status) {
    case "passed":
      return "ناجح";
    case "failed":
      return "راسب";
    case "missed":
      return "متغيب";
    default:
      return "مجدول";
  }
}

function statusClass(status: string): string {
  return status === "passed"
    ? "bg-emerald-50 text-emerald-700"
    : status === "failed" || status === "missed"
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-700";
}

export default function TeacherEvaluationsPage() {
  const { user } = useAuth();
  const teacherId = user?.teacher_profile?.id;
  const [tab, setTab] = useState<Tab>("upcoming");
  const [studentFilter, setStudentFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: evaluations = [], isLoading } = useQuery<EvaluationForTeacher[]>(
    teacherId ? "evaluations_for_teacher" : null,
    teacherId ? { teacher_id: teacherId } : undefined,
  );
  const { mutate: deleteEvaluation, isSubmitting: isDeleting } = useMutation(
    "evaluation",
    "delete",
  );

  const filtered = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return (evaluations ?? [])
      .filter((evaluation) => {
        const matchesStudent = studentFilter
          ? evaluation.student_name.includes(studentFilter)
          : true;
        const matchesDate = dateFilter
          ? evaluation.scheduled_date === dateFilter
          : true;
        const matchesTab =
          tab === "all" ||
          (tab === "upcoming"
            ? evaluation.scheduled_date >= now && evaluation.status === "scheduled"
            : evaluation.status !== "scheduled");
        return matchesStudent && matchesDate && matchesTab;
      })
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  }, [dateFilter, evaluations, studentFilter, tab]);

  async function handleDelete(evaluation: EvaluationForTeacher) {
    if (!window.confirm(`حذف اختبار ${evaluation.title} للطالب ${evaluation.student_name}؟`)) {
      return;
    }
    await deleteEvaluation({ id: evaluation.id }, { successMessage: "تم حذف الاختبار" });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-title">الاختبارات</h1>
            <p className="text-xs text-text-muted">إدارة اختبارات طلاب الحلقة</p>
          </div>
        </div>
        <Button type="button" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          إضافة اختبار
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border-card bg-white p-4 shadow-sm md:grid-cols-[1fr_180px]">
        <input
          value={studentFilter}
          onChange={(event) => setStudentFilter(event.target.value)}
          placeholder="فلتر الطالب"
          className="h-11 rounded-xl border border-border-subtle px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
          className="h-11 rounded-xl border border-border-subtle px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          dir="ltr"
        />
      </div>

      <div className="flex gap-1 rounded-2xl border border-border-card bg-white p-1 shadow-sm">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors",
              tab === item.key ? "bg-primary text-white" : "text-text-muted hover:bg-surface-subtle",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border-card bg-white p-10 text-center text-sm text-text-muted">
          جارٍ تحميل الاختبارات...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-card bg-white p-12 text-center text-sm text-text-muted">
          لا توجد اختبارات مطابقة للفلتر الحالي.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((evaluation) => (
            <article key={evaluation.id} className="rounded-2xl border border-border-card bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-text-title">{evaluation.title}</h2>
                  <p className="mt-1 text-sm text-text-muted">{evaluation.student_name}</p>
                </div>
                <span className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", statusClass(evaluation.status))}>
                  {statusLabel(evaluation.status)}
                </span>
              </div>
              <div className="space-y-2 text-xs text-text-muted">
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{evaluation.scheduled_date}</p>
                {evaluation.surah_range ? <p>النطاق: {evaluation.surah_range}</p> : null}
                {evaluation.result_note ? <p>النتيجة: {evaluation.result_note}</p> : null}
              </div>
              <div className="mt-4 flex justify-end gap-2 border-t border-border-card pt-3">
                <Button type="button" variant="ghost" disabled title="سيتم تفعيل التعديل مع حقول الدرجة والنوع في Commit 4">
                  <Pencil className="h-4 w-4" /> تعديل
                </Button>
                <Button type="button" variant="ghost" disabled={isDeleting} onClick={() => void handleDelete(evaluation)}>
                  <Trash2 className="h-4 w-4 text-danger-text" /> حذف
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <EvaluationCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        teacherId={teacherId}
      />
    </div>
  );
}
