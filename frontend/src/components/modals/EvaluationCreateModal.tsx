"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName?: string;
  onCreated?: () => void;
}

export function EvaluationCreateModal({ isOpen, onClose, studentId, studentName, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [surahRange, setSurahRange] = useState("");
  const [scheduledDate, setScheduledDate] = useState(tomorrowISO());

  const { mutate, isSubmitting, error, reset } = useMutation("evaluation", "create");

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setSurahRange("");
    setScheduledDate(tomorrowISO());
    reset();
  }, [isOpen, reset]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await mutate(
      {
        student_id: studentId,
        title: title.trim(),
        surah_range: surahRange.trim(),
        scheduled_date: scheduledDate,
      },
      { successMessage: "تم جدولة الاختبار" }
    );
    if (result) {
      onCreated?.();
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
        <div>
          <h2 className="text-lg font-bold text-primary">اختبار جديد</h2>
          {studentName && <p className="text-xs text-slate-500 mt-1">للطالب: {studentName}</p>}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">عنوان الاختبار</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: اختبار شهري"
              required
              minLength={1}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">نطاق السور (اختياري)</label>
            <Input
              value={surahRange}
              onChange={(e) => setSurahRange(e.target.value)}
              placeholder="مثال: سورة البقرة الآيات 1-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">تاريخ الاختبار</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              dir="ltr"
              required
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button type="submit" disabled={isSubmitting || !title.trim()}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="mr-1">جدولة</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
