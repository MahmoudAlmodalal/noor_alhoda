"use client";

import React, { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import { useApi } from "@/hooks/useApi";
import type { Teacher, Ring } from "@/types/api";

/**
 * Add New Ring Modal — إضافة حلقة جديدة
 */
export function AddRingModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
  const [form, setForm] = useState({
    name: "",
    level: "",
    teacher_id: "",
  });

  const { data: teachers } = useApi<Teacher[]>(isOpen ? "/api/users/teachers/" : null);
  const { mutate, isSubmitting, fieldErrors, reset } = useMutation("post", "/api/students/rings/create/");

  const handleSubmit = async () => {
    const payload: { name: string; level: string; teacher_id?: string | null } = {
      name: form.name,
      level: form.level,
    };
    if (form.teacher_id) payload.teacher_id = form.teacher_id;
    const result = await mutate(payload, { successMessage: "تم إضافة الحلقة بنجاح" });
    if (result) {
      setForm({ name: "", level: "", teacher_id: "" });
      reset();
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-6">إضافة حلقة جديدة</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">اسم الحلقة</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl border-slate-200" />
          {fieldErrors?.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">المستوى</label>
          <Input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="h-12 rounded-xl border-slate-200" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">المحفظ المسؤول <span className="text-slate-400 font-normal">(اختياري)</span></label>
          <select
            value={form.teacher_id}
            onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">— اختر المحفظ —</option>
            {(teachers ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-12 rounded-xl font-bold">
          إلغاء
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 h-12 rounded-xl font-bold gap-2">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          إضافة
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Edit Ring Modal — تعديل بيانات الحلقة
 */
export function EditRingModal({
  isOpen, onClose, ring, onSuccess,
}: {
  isOpen: boolean; onClose: () => void; ring: Ring; onSuccess?: () => void;
}) {
  const [form, setForm] = useState({
    name: ring.name,
    level: ring.level || "",
    teacher_id: ring.teacher_id || "",
    status: ring.status,
  });

  const { data: teachers } = useApi<Teacher[]>(isOpen ? "/api/users/teachers/" : null);
  const { mutate, isSubmitting, fieldErrors } = useMutation("patch");

  const handleSubmit = async () => {
    const result = await mutate(
      { ...form, teacher_id: form.teacher_id || null },
      {
        endpoint: `/api/students/rings/${ring.id}/`,
        successMessage: "تم تحديث بيانات الحلقة بنجاح",
      }
    );
    if (result) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-6">تعديل بيانات الحلقة</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">اسم الحلقة</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl border-slate-200 font-medium" />
          {fieldErrors?.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">المستوى</label>
          <Input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="h-12 rounded-xl border-slate-200 font-medium" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">المحفظ المسؤول <span className="text-slate-400 font-normal">(اختياري)</span></label>
          <select
            value={form.teacher_id}
            onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">— اختر المحفظ —</option>
            {(teachers ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">الحالة</label>
          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as Ring["status"],
              })
            }
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="active">نشطة</option>
            <option value="inactive">متوقفة</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-12 rounded-xl font-bold">
          إلغاء
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-[1.5] h-12 rounded-xl font-bold gap-2">
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          حفظ التعديلات
        </Button>
      </div>
    </Modal>
  );
}
