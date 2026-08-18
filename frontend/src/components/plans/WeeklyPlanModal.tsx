"use client";

import { useState } from "react";
import { Loader2, Save, BookOpen } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StudentPicker } from "@/components/ui/StudentPicker";
import { useMutation } from "@/hooks/useMutation";
import {
  all,
  isSaturday,
  requiredString,
} from "@/lib/validators";

function nextSaturday(): string {
  const d = new Date();
  const day = d.getDay();
  const offset = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function getWeekNumber(weekStart: string): number {
  const d = new Date(weekStart);
  const firstDay = new Date(Date.UTC(d.getFullYear(), 0, 1));
  const diffDays = Math.floor((d.getTime() - firstDay.getTime()) / 86_400_000);
  return Math.floor(diffDays / 7) + 1;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  studentId?: string;
  studentName?: string;
  onCreated?: () => void;
  editPlanId?: string;
  initialRequiredPages?: number;
  initialReviewRequiredPages?: number;
  initialWeekStart?: string;
}

export function WeeklyPlanModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  onCreated,
  editPlanId,
  initialRequiredPages,
  initialReviewRequiredPages,
  initialWeekStart,
}: Props) {
  if (!isOpen) return null;

  return (
    <WeeklyPlanModalContent
      key={`${studentId ?? ""}-${editPlanId ?? ""}-${initialWeekStart ?? ""}-${initialRequiredPages ?? ""}-${initialReviewRequiredPages ?? ""}`}
      isOpen={isOpen}
      onClose={onClose}
      studentId={studentId}
      studentName={studentName}
      onCreated={onCreated}
      editPlanId={editPlanId}
      initialRequiredPages={initialRequiredPages}
      initialReviewRequiredPages={initialReviewRequiredPages}
      initialWeekStart={initialWeekStart}
    />
  );
}

function WeeklyPlanModalContent({
  isOpen,
  onClose,
  studentId,
  studentName,
  onCreated,
  editPlanId,
  initialRequiredPages,
  initialReviewRequiredPages,
  initialWeekStart,
}: Props) {
  const [selectedId, setSelectedId] = useState(studentId ?? "");
  const [selectedName, setSelectedName] = useState(studentName ?? "");
  const [weekStart, setWeekStart] = useState<string>(initialWeekStart ?? nextSaturday());
  const [requiredPages, setRequiredPages] = useState<number>(initialRequiredPages ?? 1);
  const [reviewRequiredPages, setReviewRequiredPages] = useState<number>(initialReviewRequiredPages ?? 0);
  const [clientError, setClientError] = useState<string | null>(null);

  const { mutate: createMutate, isSubmitting: isCreating, error: createError } = useMutation("weekly_plan", "create");
  const { mutate: updateMutate, isSubmitting: isUpdating, error: updateError } = useMutation("weekly_plan", "update");

  const isSubmitting = isCreating || isUpdating;
  const error = createError || updateError;

  const handleSubmit = async () => {
    setClientError(null);

    const validation = all(
      requiredString(selectedId, "الطالب"),
      isSaturday(weekStart),
    );
    if (!validation.ok) {
      setClientError(validation.error);
      return;
    }

    if (requiredPages <= 0) {
      setClientError("عدد الصفحات المطلوبة يجب أن يكون أكبر من 0");
      return;
    }

    const pagesVal = Number(requiredPages) || 0;
    const reqLinesVal = Math.round(pagesVal * 15);

    if (editPlanId) {
      const result = await updateMutate(
        {
          id: editPlanId,
          required_pages: pagesVal,
          review_required_pages: Number(reviewRequiredPages) || 0,
          total_required_lines: reqLinesVal,
        },
        { successMessage: "تم تعديل الخطة الشهرية بنجاح" }
      );
      if (result !== null) {
        onCreated?.();
        onClose();
      }
    } else {
      const result = await createMutate(
        {
          student_id: selectedId,
          week_start: weekStart,
          week_number: getWeekNumber(weekStart),
          required_pages: pagesVal,
          review_required_pages: Number(reviewRequiredPages) || 0,
          total_required_lines: reqLinesVal,
        },
        { successMessage: "تم إنشاء الخطة الشهرية بنجاح" }
      );
      if (result !== null) {
        onCreated?.();
        onClose();
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <h2 className="text-xl font-bold text-primary mb-6">
        {editPlanId ? "تعديل الخطة الشهرية" : "إضافة خطة شهرية"}
      </h2>

      <div className="space-y-4 mb-8">
        {studentId || editPlanId ? (
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-body">الطالب</label>
            <div className="h-12 rounded-xl border border-border-subtle bg-surface-subtle px-4 flex items-center text-sm font-bold text-text-body">
              {selectedName || "—"}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-body">الطالب</label>
            <StudentPicker
              selectedId={selectedId}
              selectedName={selectedName}
              onSelect={(id, name) => {
                setSelectedId(id);
                setSelectedName(name);
              }}
              enabled={isOpen}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">بداية الخطة (السبت)</label>
          <Input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            aria-label="بداية الأسبوع"
            className="h-12 rounded-xl border-border-subtle"
            dir="ltr"
            disabled={!!editPlanId}
          />
        </div>

        {/* مستهدف الحفظ والمراجعة */}
        <div className="border border-blue-100 bg-blue-50/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
            <BookOpen className="w-4 h-4 text-secondary" />
            <span>مستهدف الحفظ المطلوب</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-text-body">عدد الصفحات المطلوبة</label>
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={requiredPages}
              onChange={(e) => setRequiredPages(Number(e.target.value))}
              aria-label="عدد الصفحات المطلوبة"
              className="h-11 rounded-xl border-border-subtle bg-white text-left font-bold"
              dir="ltr"
            />
          </div>

          <p className="text-[11px] text-text-muted leading-relaxed">
            يتم احتساب الصفحات المنجزة تلقائياً من تسجيل التسميع والحضور، كل 15 سطراً = صفحة.
          </p>

          <div className="space-y-1.5 pt-2 border-t border-blue-100">
            <label className="block text-xs font-bold text-text-body">عدد صفحات المراجعة المطلوبة</label>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={reviewRequiredPages}
              onChange={(e) => setReviewRequiredPages(Number(e.target.value))}
              aria-label="عدد صفحات المراجعة المطلوبة"
              className="h-11 rounded-xl border-border-subtle bg-white text-left font-bold"
              dir="ltr"
            />
          </div>
        </div>

        {(clientError || error) && (
          <p className="text-sm text-red-500">{clientError || error}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onClose}
          className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-12 rounded-xl font-bold"
        >
          إلغاء
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedId}
          className="flex-[1.5] h-12 rounded-xl font-bold gap-2"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {editPlanId ? "تعديل الخطة" : "حفظ الخطة الشهرية"}
        </Button>
      </div>
    </Modal>
  );
}
