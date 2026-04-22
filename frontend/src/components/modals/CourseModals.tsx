"use client";

import React, { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import type { CourseRecord } from "@/hooks/queries";

export function AddCourseModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [form, setForm] = useState({ name: "", description: "" });
  const { mutate, isSubmitting, error, reset } = useMutation("course", "create");

  const handleSubmit = async () => {
    const result = await mutate(form, { successMessage: "تم إضافة الدورة بنجاح" });
    if (result) {
      setForm({ name: "", description: "" });
      reset();
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-6">إضافة دورة جديدة</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">اسم الدورة</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-label="اسم الدورة"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الوصف</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            aria-label="وصف الدورة"
            rows={4}
            className="w-full rounded-xl border border-border-subtle bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
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
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          إضافة
        </Button>
      </div>
    </Modal>
  );
}

export function EditCourseModal({
  isOpen,
  onClose,
  course,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  course: CourseRecord;
  onSuccess?: () => void;
}) {
  const [form, setForm] = useState({
    name: course.name,
    description: course.description || "",
  });
  const { mutate, isSubmitting, error } = useMutation("course", "update");

  const handleSubmit = async () => {
    const result = await mutate(
      { id: course.id, ...form },
      { successMessage: "تم تحديث الدورة بنجاح" }
    );
    if (result) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-6">تعديل بيانات الدورة</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">اسم الدورة</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-label="اسم الدورة"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الوصف</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            aria-label="وصف الدورة"
            rows={4}
            className="w-full rounded-xl border border-border-subtle bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
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
          className="flex-[1.5] h-12 rounded-xl font-bold gap-2"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          حفظ التعديلات
        </Button>
      </div>
    </Modal>
  );
}
