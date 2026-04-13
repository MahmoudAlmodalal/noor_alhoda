"use client";

import React, { useState } from "react";
import { Trash2, Save, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import type { Teacher } from "@/types/api";

/**
 * Add New Teacher Modal — إضافة محفظ جديد
 */
export function AddTeacherModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    specialization: "",
    affiliation: "",
  });

  const { mutate, isSubmitting, fieldErrors, reset, error } = useMutation("post", "/api/users/teachers/create/");

  const handleSubmit = async () => {
    const nameParts = form.full_name.trim().split(" ");
    const result = await mutate({
      phone_number: form.phone_number,
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      full_name: form.full_name,
      specialization: form.specialization,
      affiliation: form.affiliation,
    }, { successMessage: "تم إضافة المحفظ بنجاح" });

    if (result) {
      setForm({ full_name: "", phone_number: "", specialization: "", affiliation: "" });
      reset();
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-6">إضافة محفظ جديد</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">الاسم الرباعي</label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} aria-label="الاسم الرباعي" className="h-12 rounded-xl border-slate-200" />
          {fieldErrors?.full_name && <p className="text-xs text-red-500">{fieldErrors.full_name}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">رقم الجوال</label>
          <Input type="tel" dir="ltr" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} aria-label="رقم الجوال" className="h-12 rounded-xl border-slate-200" />
          {fieldErrors?.phone_number && <p className="text-xs text-red-500">{fieldErrors.phone_number}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">التخصص (اختياري)</label>
          <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} aria-label="التخصص" className="h-12 rounded-xl border-slate-200" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">التباعية</label>
          <select
            value={form.affiliation}
            onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
            aria-label="التباعية"
            className="w-full h-12 rounded-xl border border-slate-200 px-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">اختر التباعية...</option>
            <option value="dar_quran">دار القرآن</option>
            <option value="awqaf">أوقاف</option>
          </select>
          {fieldErrors?.affiliation && <p className="text-xs text-red-500">{fieldErrors.affiliation}</p>}
        </div>
      </div>

      {error && !fieldErrors && (
        <p className="text-sm text-red-500 mb-4">{error}</p>
      )}

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
 * 3. Confirm Deletion Modal — تأكيد الحذف
 */
export function ConfirmDeleteModal({
  isOpen, onClose, targetName, deleteEndpoint, onSuccess,
}: {
  isOpen: boolean; onClose: () => void; targetName: string; deleteEndpoint?: string; onSuccess?: () => void;
}) {
  const { mutate, isSubmitting, error } = useMutation("delete");

  const handleDelete = async () => {
    if (!deleteEndpoint) return;
    const result = await mutate(undefined, {
      endpoint: deleteEndpoint,
      successMessage: "تم الحذف بنجاح",
    });
    if (result !== null) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="text-center pt-8">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <Trash2 className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-4">تأكيد الحذف</h2>
      <p className="text-lg text-slate-600 font-medium mb-8">
        هل أنت متأكد من حذف <br /> <span className="font-bold text-primary">{targetName}</span>؟
      </p>

      {error && (
        <p className="text-sm text-red-500 mb-4">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-14 rounded-2xl font-bold text-lg">
          إلغاء
        </Button>
        <Button onClick={handleDelete} disabled={isSubmitting} className="flex-1 h-14 rounded-2xl font-bold text-lg bg-[#dd1111] hover:bg-[#c00f0f] text-white gap-2">
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          نعم، احذف
        </Button>
      </div>
    </Modal>
  );
}

/**
 * 4. Edit Teacher Data Modal — تعديل بيانات المحفظ
 */
export function EditTeacherModal({
  isOpen, onClose, teacher, onSuccess,
}: {
  isOpen: boolean; onClose: () => void; teacher: Teacher; onSuccess?: () => void;
}) {
  const [form, setForm] = useState({
    full_name: teacher.full_name,
    phone_number: teacher.phone_number || "",
    specialization: teacher.specialization || "",
    affiliation: teacher.affiliation || "",
  });

  const { mutate, isSubmitting, fieldErrors, error } = useMutation("patch");

  const handleSubmit = async () => {
    const nameParts = form.full_name.trim().split(" ");
    const payload: Record<string, string> = {
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      phone_number: form.phone_number,
      specialization: form.specialization,
      affiliation: form.affiliation,
    };
    const result = await mutate(payload, {
      endpoint: `/api/users/${teacher.user_id}/`,
      successMessage: "تم تحديث بيانات المحفظ بنجاح",
    });
    if (result) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-6">تعديل بيانات المحفظ</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">الاسم الرباعي</label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} aria-label="الاسم الرباعي" className="h-12 rounded-xl border-slate-200 font-medium" />
          {fieldErrors?.full_name && <p className="text-xs text-red-500">{fieldErrors.full_name}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">رقم الجوال</label>
          <Input type="tel" dir="ltr" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} aria-label="رقم الجوال" className="h-12 rounded-xl border-slate-200 font-medium" />
          {fieldErrors?.phone_number && <p className="text-xs text-red-500">{fieldErrors.phone_number}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">التخصص</label>
          <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} aria-label="التخصص" className="h-12 rounded-xl border-slate-200 font-medium" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">التباعية</label>
          <select
            value={form.affiliation}
            onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
            aria-label="التباعية"
            className="w-full h-12 rounded-xl border border-slate-200 px-3 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">اختر التباعية...</option>
            <option value="dar_quran">دار القرآن</option>
            <option value="awqaf">أوقاف</option>
          </select>
          {fieldErrors?.affiliation && <p className="text-xs text-red-500">{fieldErrors.affiliation}</p>}
        </div>
      </div>

      {error && !fieldErrors && (
        <p className="text-sm text-red-500 mb-4">{error}</p>
      )}

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
