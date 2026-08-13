"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import type { EvaluationForTeacher } from "@/lib/db/repos/aggregates";

const MAX_SCORE = 100;
type GradeStatus = "passed" | "failed" | "missed";

const STATUS_OPTIONS: Array<{ value: GradeStatus; label: string }> = [
  { value: "passed", label: "ناجح" },
  { value: "failed", label: "راسب" },
  { value: "missed", label: "متغيب" },
];

function isGradeStatus(value: string): value is GradeStatus {
  return value === "passed" || value === "failed" || value === "missed";
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  evaluation: EvaluationForTeacher | null;
}

export function EvaluationGradeModal({ isOpen, onClose, evaluation }: Props) {
  const [status, setStatus] = useState<GradeStatus | "">("");
  const [score, setScore] = useState("");
  const [resultNote, setResultNote] = useState("");
  const { mutate, isSubmitting, error, reset } = useMutation("evaluation", "update");

  useEffect(() => {
    if (!isOpen || !evaluation) return;
    setStatus(isGradeStatus(evaluation.status) ? evaluation.status : "");
    setScore(evaluation.score ?? "");
    setResultNote(evaluation.result_note ?? "");
    reset();
  }, [evaluation, isOpen, reset]);

  if (!isOpen || !evaluation) return null;

  const scoreRequired = status === "passed" || status === "failed";
  const scoreNumber = score.trim() === "" ? null : Number(score);
  const scoreIsValid =
    !scoreRequired ||
    (scoreNumber !== null && Number.isFinite(scoreNumber) && scoreNumber >= 0 && scoreNumber <= MAX_SCORE);
  const canSubmit = Boolean(status) && scoreIsValid && !isSubmitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!status || !scoreIsValid || !evaluation) return;

    const maxScore = Number(evaluation.max_score || MAX_SCORE);
    const result = await mutate(
      {
        id: evaluation.id,
        status,
        score: status === "missed" ? null : String(scoreNumber),
        max_score: String(Number.isFinite(maxScore) && maxScore > 0 ? maxScore : MAX_SCORE),
        result_note: resultNote.trim(),
      },
      { successMessage: "تم حفظ تقييم الاختبار" },
    );

    if (result) onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
        <div>
          <h2 className="text-lg font-bold text-primary">تقييم الاختبار</h2>
          <p className="mt-1 text-xs text-text-muted">حدّد نتيجة الاختبار واحفظ ملاحظة المعلم إن وجدت.</p>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border-card bg-surface-subtle p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-text-muted">الطالب</span>
            <strong className="text-text-title">{evaluation.student_name}</strong>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-text-muted">عنوان الاختبار</span>
            <strong className="text-text-title">{evaluation.title}</strong>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-text-muted">تاريخ الاختبار</span>
            <strong className="text-text-title" dir="ltr">{evaluation.scheduled_date}</strong>
          </div>
          {evaluation.surah_range ? (
            <div className="flex items-start justify-between gap-3">
              <span className="text-text-muted">نطاق السور</span>
              <strong className="text-text-title text-end">{evaluation.surah_range}</strong>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-text-body">النتيجة</label>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={
                  status === option.value
                    ? "rounded-xl border border-primary bg-primary px-3 py-3 text-xs font-bold text-white"
                    : "rounded-xl border border-border-subtle bg-white px-3 py-3 text-xs font-bold text-text-muted hover:border-primary/40"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-body" htmlFor="evaluation-score">
            الدرجة {status === "missed" ? "(غير مطلوبة للمتغيب)" : ""}
          </label>
          <Input
            id="evaluation-score"
            type="number"
            min={0}
            max={MAX_SCORE}
            step="0.01"
            value={status === "missed" ? "" : score}
            onChange={(event) => setScore(event.target.value)}
            placeholder="0"
            disabled={status === "missed"}
            dir="ltr"
            aria-describedby="evaluation-score-help"
          />
          <p id="evaluation-score-help" className="text-[11px] text-text-muted">الدرجة من 100</p>
          {!scoreIsValid ? (
            <p className="text-xs text-danger-text">أدخل درجة رقمية بين 0 و100.</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-body" htmlFor="evaluation-result-note">ملاحظة النتيجة (اختياري)</label>
          <textarea
            id="evaluation-result-note"
            value={resultNote}
            onChange={(event) => setResultNote(event.target.value)}
            rows={3}
            placeholder="مثال: الحفظ ممتاز مع وجود خطأين في سورة..."
            className="w-full resize-y rounded-[14px] border border-border-subtle bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {error ? <p className="text-xs text-danger-text">{error}</p> : null}

        <div className="flex items-center justify-end gap-2 border-t border-border-card pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>إلغاء</Button>
          <Button type="submit" disabled={!canSubmit}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>حفظ التقييم</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
