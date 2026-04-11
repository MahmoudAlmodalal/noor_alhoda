"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import type { Student, WeeklyPlanRequest } from "@/types/api";

function nextSaturday(): string {
  const d = new Date();
  const day = d.getDay();
  const offset = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  studentId?: string;
  studentName?: string;
  onCreated?: () => void;
}

export function WeeklyPlanModal({ isOpen, onClose, studentId, studentName, onCreated }: Props) {
  const [selectedId, setSelectedId] = useState(studentId ?? "");
  const [selectedName, setSelectedName] = useState(studentName ?? "");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [weekStart, setWeekStart] = useState<string>(nextSaturday());
  const [totalRequired, setTotalRequired] = useState<number>(20);

  const { data: students, refetch } = useApi<Student[]>(
    isOpen && !studentId ? "/api/students/" : null
  );
  useEffect(() => {
    if (isOpen && !studentId) refetch({ search: debouncedSearch });
  }, [isOpen, studentId, debouncedSearch, refetch]);

  useEffect(() => {
    if (isOpen) {
      setSelectedId(studentId ?? "");
      setSelectedName(studentName ?? "");
      setWeekStart(nextSaturday());
      setTotalRequired(20);
      setSearch("");
    }
  }, [isOpen, studentId, studentName]);

  const { mutate, isSubmitting, fieldErrors, error } = useMutation(
    "post",
    "/api/records/weekly-plans/"
  );

  const filteredStudents = useMemo(() => (students ?? []).slice(0, 10), [students]);

  const handleSubmit = async () => {
    if (!selectedId) return;
    const payload: WeeklyPlanRequest = {
      student_id: selectedId,
      week_start: weekStart,
      total_required: Number(totalRequired) || 0,
    };
    const result = await mutate(payload, { successMessage: "تم إنشاء الخطة الأسبوعية" });
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
            <label className="block text-sm font-bold text-slate-800">الطالب</label>
            <div className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 flex items-center text-sm font-bold text-slate-700">
              {selectedName || "—"}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-800">الطالب</label>
            <Input
              placeholder="ابحث عن طالب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 rounded-xl border-slate-200"
            />
            {filteredStudents.length > 0 && !selectedId && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50">
                {filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(s.id);
                      setSelectedName(s.full_name);
                      setSearch(s.full_name);
                    }}
                    className="w-full text-start px-3 py-2 text-sm hover:bg-white border-b border-slate-100 last:border-b-0"
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
            {fieldErrors?.student_id && (
              <p className="text-xs text-red-500">{fieldErrors.student_id}</p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">بداية الأسبوع (السبت)</label>
          <Input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="h-12 rounded-xl border-slate-200"
            dir="ltr"
          />
          {fieldErrors?.week_start && (
            <p className="text-xs text-red-500">{fieldErrors.week_start}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">عدد الآيات المطلوبة</label>
          <Input
            type="number"
            min={1}
            value={totalRequired}
            onChange={(e) => setTotalRequired(Number(e.target.value))}
            className="h-12 rounded-xl border-slate-200"
            dir="ltr"
          />
          {fieldErrors?.total_required && (
            <p className="text-xs text-red-500">{fieldErrors.total_required}</p>
          )}
        </div>

        {error && !fieldErrors && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onClose}
          className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-12 rounded-xl font-bold"
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
