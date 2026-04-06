"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useMutation } from "@/hooks/useMutation";
import { useApi } from "@/hooks/useApi";
import type { Teacher } from "@/types/api";

/**
 * Assign Student to Teacher Modal — تعيين الطالب لمحفظ
 */
export function AssignStudentModal({
  isOpen, onClose, studentId, studentName, onSuccess,
}: {
  isOpen: boolean; onClose: () => void; studentId: string; studentName: string; onSuccess?: () => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const { data: teachers } = useApi<Teacher[]>(isOpen ? "/api/users/teachers/" : null);
  const { mutate, isSubmitting } = useMutation("patch");

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) setTeacherId("");
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!teacherId) return;
    const result = await mutate(
      { teacher_id: teacherId },
      { endpoint: `/api/students/${studentId}/assign-teacher/`, successMessage: "تم تعيين المحفظ بنجاح" }
    );
    if (result) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-2">تعيين الطالب لمحفظ</h2>
      <p className="text-sm text-slate-500 font-medium mb-6">
        تعيين الطالب: <span className="font-bold text-slate-800">{studentName}</span>
      </p>

      <div className="space-y-1.5 mb-8">
        <label className="block text-sm font-bold text-slate-800">اختر المحفظ</label>
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">— اختر المحفظ —</option>
          {(teachers ?? []).map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-12 rounded-xl font-bold">
          إلغاء
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !teacherId} className="flex-1 h-12 rounded-xl font-bold gap-2">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          حفظ التعيين
        </Button>
      </div>
    </Modal>
  );
}
