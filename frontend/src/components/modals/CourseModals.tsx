"use client";

import React, { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import type { Course } from "@/types/api";

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
  const { mutate, isSubmitting, fieldErrors, reset, error } = useMutation(
    "post",
    "/api/courses/create/"
  );

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
          <label className="block text-sm font-bold text-slate-800">اسم الدورة</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-label="اسم الدورة"
            className="h-12 rounded-xl border-slate-200"
          />
          {fieldErrors?.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">الوصف</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            aria-label="وصف الدورة"
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>
      </div>

      {error && !fieldErrors && (
        <p className="text-sm text-red-500 mb-4">{error}</p>
      )}

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
  course: Course;
  onSuccess?: () => void;
}) {
  const [form, setForm] = useState({
    name: course.name,
    description: course.description || "",
  });
  const { mutate, isSubmitting, fieldErrors, error } = useMutation("patch");

  const handleSubmit = async () => {
    const result = await mutate(form, {
      endpoint: `/api/courses/${course.id}/`,
      successMessage: "تم تحديث الدورة بنجاح",
    });
    if (result) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-6">تعديل بيانات الدورة</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">اسم الدورة</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-label="اسم الدورة"
            className="h-12 rounded-xl border-slate-200 font-medium"
          />
          {fieldErrors?.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">الوصف</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            aria-label="وصف الدورة"
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>
      </div>

      {error && !fieldErrors && (
        <p className="text-sm text-red-500 mb-4">{error}</p>
      )}

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
