"use client";

import React, { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import type { StudentRecord } from "@/lib/db/repos/students";

export function UpdateMemorizationModal({
  isOpen,
  onClose,
  student,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  student: StudentRecord;
  onSuccess?: () => void;
}) {
  const [form, setForm] = useState({
    current_surah: student.current_surah,
    current_aya: student.current_aya ? String(student.current_aya) : "",
  });

  const { mutate, isSubmitting, error, reset } = useMutation("student", "update");

  const handleSubmit = async () => {
    const result = await mutate(
      {
        id: student.id,
        current_surah: form.current_surah,
        current_aya: form.current_aya ? Number(form.current_aya) : null,
      },
      { successMessage: "تم تحديث موضع الحفظ بنجاح" }
    );
    if (result) {
      reset();
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-6">تحديث موضع الحفظ</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">السورة الحالية</label>
          <Input
            value={form.current_surah}
            onChange={(e) => setForm({ ...form, current_surah: e.target.value })}
            aria-label="السورة الحالية"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الآية</label>
          <Input
            type="number"
            value={form.current_aya}
            onChange={(e) => setForm({ ...form, current_aya: e.target.value })}
            aria-label="رقم الآية"
            className="h-12 rounded-xl border-border-subtle"
            min="1"
            dir="ltr"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

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
          disabled={isSubmitting}
          className="flex-1 h-12 rounded-xl font-bold gap-2"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          تحديث
        </Button>
      </div>
    </Modal>
  );
}
