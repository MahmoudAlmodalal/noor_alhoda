"use client";

import { useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import { useQuery } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import type { StudentWithTeacher } from "@/hooks/queries";

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
}

export function WeeklyPlanModal({ isOpen, onClose, studentId, studentName, onCreated }: Props) {
  if (!isOpen) return null;

  return (
    <WeeklyPlanModalContent
      isOpen={isOpen}
      onClose={onClose}
      studentId={studentId}
      studentName={studentName}
      onCreated={onCreated}
    />
  );
}

function WeeklyPlanModalContent({ isOpen, onClose, studentId, studentName, onCreated }: Props) {
  const [selectedId, setSelectedId] = useState(studentId ?? "");
  const [selectedName, setSelectedName] = useState(studentName ?? "");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [weekStart, setWeekStart] = useState<string>(nextSaturday());
  const [totalRequired, setTotalRequired] = useState<number>(20);

  const { data: students } = useQuery<StudentWithTeacher[]>(
    isOpen && !studentId ? "students_with_teacher" : null,
    debouncedSearch ? { search: debouncedSearch } : undefined
  );

  const { mutate, isSubmitting, error } = useMutation("weekly_plan", "create");

  const filteredStudents = useMemo(() => (students ?? []).slice(0, 10), [students]);

  const handleSubmit = async () => {
    if (!selectedId) return;
    const result = await mutate(
      {
        student_id: selectedId,
        week_start: weekStart,
        week_number: getWeekNumber(weekStart),
        total_required: Number(totalRequired) || 0,
      },
      { successMessage: "تم إنشاء الخطة الأسبوعية" }
    );
    if (result !== null) {
      onCreated?.();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <h2 className="text-xl font-bold text-primary mb-6">إضافة خطة أسبوعية</h2>

      <div className="space-y-4 mb-8">
        {studentId ? (
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-body">الطالب</label>
            <div className="h-12 rounded-xl border border-border-subtle bg-surface-subtle px-4 flex items-center text-sm font-bold text-text-body">
              {selectedName || "—"}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-body">الطالب</label>
            <Input
              placeholder="ابحث عن طالب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="ابحث عن طالب"
              className="h-12 rounded-xl border-border-subtle"
            />
            {filteredStudents.length > 0 && !selectedId && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border-card bg-surface-subtle/50">
                {filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(s.id);
                      setSelectedName(s.full_name);
                      setSearch(s.full_name);
                    }}
                    className="w-full text-start px-3 py-2 text-sm hover:bg-white border-b border-border-card last:border-b-0"
                  >
                    {s.full_name}
                  </button>
                ))}
              </div>
            )}
            {selectedId && (
              <p className="text-xs text-primary font-bold mt-1">
                تم اختيار: {selectedName}
              </p>
            )}
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
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">عدد الآيات المطلوبة</label>
          <Input
            type="number"
            min={1}
            value={totalRequired}
            onChange={(e) => setTotalRequired(Number(e.target.value))}
            aria-label="عدد الآيات المطلوبة"
            className="h-12 rounded-xl border-border-subtle"
            dir="ltr"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
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
          حفظ الخطة
        </Button>
      </div>
    </Modal>
  );
}
