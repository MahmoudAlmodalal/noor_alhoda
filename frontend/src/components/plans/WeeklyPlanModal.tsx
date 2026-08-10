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
  positiveInt,
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
  initialTotalRequired?: number;
  initialTotalRequiredLines?: number;
  initialWeekStart?: string;
}

export function WeeklyPlanModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  onCreated,
  editPlanId,
  initialTotalRequired,
  initialTotalRequiredLines,
  initialWeekStart,
}: Props) {
  if (!isOpen) return null;

  return (
    <WeeklyPlanModalContent
      key={`${studentId ?? ""}-${editPlanId ?? ""}-${initialWeekStart ?? ""}-${initialTotalRequired ?? ""}-${initialTotalRequiredLines ?? ""}`}
      isOpen={isOpen}
      onClose={onClose}
      studentId={studentId}
      studentName={studentName}
      onCreated={onCreated}
      editPlanId={editPlanId}
      initialTotalRequired={initialTotalRequired}
      initialTotalRequiredLines={initialTotalRequiredLines}
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
  initialTotalRequired,
  initialTotalRequiredLines,
  initialWeekStart,
}: Props) {
  const [selectedId, setSelectedId] = useState(studentId ?? "");
  const [selectedName, setSelectedName] = useState(studentName ?? "");
  const [weekStart, setWeekStart] = useState<string>(initialWeekStart ?? nextSaturday());
  const [totalRequired, setTotalRequired] = useState<number>(initialTotalRequired ?? 20);
  const [totalRequiredLines, setTotalRequiredLines] = useState<number>(initialTotalRequiredLines ?? 15);
  const [clientError, setClientError] = useState<string | null>(null);

  const calculatedPages = totalRequiredLines > 0 ? (totalRequiredLines / 15).toFixed(1) : "0";

  const { mutate: createMutate, isSubmitting: isCreating, error: createError } = useMutation("weekly_plan", "create");
  const { mutate: updateMutate, isSubmitting: isUpdating, error: updateError } = useMutation("weekly_plan", "update");

  const isSubmitting = isCreating || isUpdating;
  const error = createError || updateError;

  const handleSubmit = async () => {
    setClientError(null);

    const validation = all(
      requiredString(selectedId, "الطالب"),
      isSaturday(weekStart),
      positiveInt(totalRequired, "عدد الآيات المطلوبة"),
    );
    if (!validation.ok) {
      setClientError(validation.error);
      return;
    }

    if (editPlanId) {
      const result = await updateMutate(
        {
          id: editPlanId,
          total_required: Number(totalRequired) || 0,
          total_required_lines: Number(totalRequiredLines) || 0,
        },
        { successMessage: "تم تعديل الخطة الأسبوعية بنجاح" }
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
          total_required: Number(totalRequired) || 0,
          total_required_lines: Number(totalRequiredLines) || 0,
        },
        { successMessage: "تم إنشاء الخطة الأسبوعية بنجاح" }
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
        {editPlanId ? "تعديل الخطة الأسبوعية" : "إضافة خطة أسبوعية"}
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
          <label className="block text-sm font-bold text-text-body">بداية الأسبوع (السبت)</label>
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

        {/* بند الحفظ: الآيات المطلوبة والأسطر المطلوبة */}
        <div className="border border-blue-100 bg-blue-50/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
            <BookOpen className="w-4 h-4 text-secondary" />
            <span>مستهدف الحفظ المطلوب</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-body">عدد الآيات المطلوبة</label>
              <Input
                type="number"
                min={1}
                value={totalRequired}
                onChange={(e) => setTotalRequired(Number(e.target.value))}
                aria-label="عدد الآيات المطلوبة"
                className="h-11 rounded-xl border-border-subtle bg-white text-left font-bold"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-body">عدد الأسطر المطلوبة</label>
              <Input
                type="number"
                min={0}
                value={totalRequiredLines}
                onChange={(e) => setTotalRequiredLines(Number(e.target.value))}
                aria-label="عدد الأسطر المطلوبة"
                className="h-11 rounded-xl border-border-subtle bg-white text-left font-bold"
                dir="ltr"
              />
            </div>
          </div>

          {/* الحساب التلقائي للصفحات (15 سطر = 1 صفحة) */}
          <div className="bg-white border border-blue-100 rounded-xl p-3 flex items-center justify-between text-xs font-bold text-primary">
            <span className="text-text-body">الصفحات المحتسبة تلقائياً:</span>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-black">
              {calculatedPages} صفحة <span className="text-[10px] text-text-muted font-normal">(لكل 15 سطر)</span>
            </span>
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
          {editPlanId ? "تعديل الخطة" : "حفظ الخطة"}
        </Button>
      </div>
    </Modal>
  );
}
