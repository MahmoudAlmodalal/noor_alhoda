"use client";

import { AlertTriangle, CheckCircle2, Inbox, RotateCcw } from "lucide-react";
import { QualityBadge } from "@/components/ui/QualityBadge";
import { useQuery } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useMutation";
import type { ReviewsForTeacher } from "@/lib/db/repos/aggregates";
import { cn } from "@/lib/utils";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  teacherId: string;
}

export function TeacherReviewsTab({ teacherId }: Props) {
  const { data, isLoading } = useQuery<ReviewsForTeacher>(
    "reviews_for_teacher",
    { teacher_id: teacherId }
  );
  const createReview = useMutation("review_record", "create");

  const handleMarkReviewed = async (student_id: string, surah_name: string) => {
    await createReview.mutate(
      {
        student_id,
        surah_name,
        reviewed_date: todayIso(),
        quality: "good",
        note: "",
      },
      { successMessage: "تم تسجيل المراجعة" }
    );
  };

  const due = data?.due ?? [];
  const history = data?.history ?? [];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <section className="overflow-hidden rounded-[24px] border border-border-card bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-bold text-text-body">
              مراجعات مستحقة
              <span className="ms-2 text-xs font-medium text-text-muted">
                ({due.length})
              </span>
            </h2>
          </div>
        </div>

        {isLoading && !data ? (
          <div className="px-5 py-10 text-center text-sm text-text-muted">
            جارٍ التحميل...
          </div>
        ) : due.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium text-text-muted">
              لا توجد مراجعات مستحقة حالياً.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-surface-subtle/80 text-xs text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">الطالب</th>
                  <th className="px-4 py-3 font-bold">السورة</th>
                  <th className="px-4 py-3 font-bold">آخر مراجعة</th>
                  <th className="px-4 py-3 font-bold">أيام التأخير</th>
                  <th className="px-4 py-3 font-bold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {due.map((row) => {
                  const overdue = row.days_since_review - row.review_interval_days;
                  const urgencyClass =
                    overdue >= 14
                      ? "bg-red-50 text-red-600"
                      : overdue >= 7
                        ? "bg-amber-50 text-amber-700"
                        : "bg-orange-50 text-orange-600";
                  return (
                    <tr
                      key={`${row.student_id}-${row.surah_name}`}
                      className="border-b border-border-card last:border-b-0"
                    >
                      <td className="px-4 py-3 font-semibold text-text-body">
                        {row.student_name}
                      </td>
                      <td className="px-4 py-3 text-text-label">
                        {row.surah_name}
                      </td>
                      <td className="px-4 py-3 text-text-label" dir="ltr">
                        {row.last_reviewed ?? row.last_memorized}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold",
                            urgencyClass
                          )}
                        >
                          {row.days_since_review} يوم
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            handleMarkReviewed(row.student_id, row.surah_name)
                          }
                          disabled={createReview.isSubmitting}
                          className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          تم المراجعة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[24px] border border-border-card bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border-card p-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-text-body">
              سجل المراجعات
              <span className="ms-2 text-xs font-medium text-text-muted">
                ({history.length})
              </span>
            </h2>
          </div>
        </div>

        {isLoading && !data ? (
          <div className="px-5 py-10 text-center text-sm text-text-muted">
            جارٍ التحميل...
          </div>
        ) : history.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-text-muted" />
            <p className="text-sm font-medium text-text-muted">
              لا يوجد سجل مراجعات بعد.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-surface-subtle/80 text-xs text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">الطالب</th>
                  <th className="px-4 py-3 font-bold">السورة</th>
                  <th className="px-4 py-3 font-bold">التاريخ</th>
                  <th className="px-4 py-3 font-bold">الجودة</th>
                  <th className="px-4 py-3 font-bold">ملاحظة</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border-card last:border-b-0"
                  >
                    <td className="px-4 py-3 font-semibold text-text-body">
                      {r.student_name}
                    </td>
                    <td className="px-4 py-3 text-text-label">{r.surah_name}</td>
                    <td className="px-4 py-3 text-text-label" dir="ltr">
                      {r.reviewed_date}
                    </td>
                    <td className="px-4 py-3">
                      <QualityBadge value={r.quality} />
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      {r.note ? (
                        <span
                          title={r.note}
                          className="line-clamp-1 text-xs text-text-muted"
                        >
                          {r.note}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
