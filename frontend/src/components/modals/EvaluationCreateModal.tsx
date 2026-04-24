"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StudentPicker } from "@/components/ui/StudentPicker";
import { useMutation } from "@/hooks/useMutation";

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  studentId?: string;
  studentName?: string;
  teacherId?: string;
  onCreated?: () => void;
}

export function EvaluationCreateModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  teacherId,
  onCreated,
}: Props) {
  const [selectedId, setSelectedId] = useState(studentId ?? "");
  const [selectedName, setSelectedName] = useState(studentName ?? "");
  const [title, setTitle] = useState("");
  const [surahRange, setSurahRange] = useState("");
  const [scheduledDate, setScheduledDate] = useState(tomorrowISO());

  const { mutate, isSubmitting, error, reset } = useMutation(
    "evaluation",
    "create"
  );

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setSelectedId(studentId ?? "");
      setSelectedName(studentName ?? "");
      setTitle("");
      setSurahRange("");
      setScheduledDate(tomorrowISO());
      reset();
    });
  }, [isOpen, studentId, studentName, reset]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    const result = await mutate(
      {
        student_id: selectedId,
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
          {studentId && studentName ? (
            <p className="text-xs text-text-muted mt-1">للطالب: {studentName}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          {!studentId ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-body">الطالب</label>
              <StudentPicker
                selectedId={selectedId}
                selectedName={selectedName}
                onSelect={(id, name) => {
                  setSelectedId(id);
                  setSelectedName(name);
                }}
                enabled={isOpen}
                teacherId={teacherId}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-body">عنوان الاختبار</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: اختبار شهري"
              required
              minLength={1}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-body">نطاق السور (اختياري)</label>
            <Input
              value={surahRange}
              onChange={(e) => setSurahRange(e.target.value)}
              placeholder="مثال: سورة البقرة الآيات 1-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-body">تاريخ الاختبار</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="h-11 w-full rounded-[14px] border border-border-subtle bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              dir="ltr"
              required
            />
          </div>
        </div>

        {error && <p className="text-xs text-danger-text">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button type="submit" disabled={isSubmitting || !title.trim() || !selectedId}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="mr-1">جدولة</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
