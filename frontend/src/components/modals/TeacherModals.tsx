"use client";

import React, { useState, useEffect } from "react";
import { Trash2, Save, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import { useApi } from "@/hooks/useApi";
import type { Teacher, Ring } from "@/types/api";

/**
 * 1. Assign Ring Modal — تعيين حلقة للمحفظ
 * TODO: Wire to rings API when backend endpoint is available
 */
export function AssignRingModal({ 
  isOpen, onClose, teacherId, teacherName, onSuccess 
}: { 
  isOpen: boolean; onClose: () => void; teacherId: string; teacherName: string; onSuccess?: () => void 
}) {
  const [ringId, setRingId] = useState("");
  const { data: rings } = useApi<Ring[]>(isOpen ? "/api/students/rings/" : null);
  const { mutate, isSubmitting } = useMutation("patch");

  useEffect(() => {
    if (isOpen) setRingId("");
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!ringId) return;
    const result = await mutate(
      { ring_id: ringId },
      { endpoint: `/api/students/teachers/${teacherId}/assign-ring/`, successMessage: "تم تعيين الحلقة بنجاح" }
    );
    if (result) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-2">تعيين حلقة للمحفظ</h2>
      <p className="text-sm text-slate-500 font-medium mb-6">
        تعيين حلقة للشيخ: <span className="font-bold text-slate-800">{teacherName}</span>
      </p>
      <div className="space-y-1.5 mb-8">
        <label className="block text-sm font-bold text-slate-800">اختر الحلقة</label>
        <select
          value={ringId}
          onChange={(e) => setRingId(e.target.value)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">— اختر الحلقة —</option>
          {(rings ?? []).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-12 rounded-xl font-bold">
          إلغاء
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !ringId} className="flex-1 h-12 rounded-xl font-bold gap-2">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          حفظ التعيين
        </Button>
      </div>
    </Modal>
  );
}

/**
 * 2. Add New Teacher Modal — إضافة محفظ جديد
 */
export function AddTeacherModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    password: "nooralhuda2026",
    specialization: "",
  });

  const { mutate, isSubmitting, fieldErrors, reset } = useMutation("post", "/api/users/teachers/create/");

  const handleSubmit = async () => {
    const nameParts = form.full_name.trim().split(" ");
    const result = await mutate({
      phone_number: form.phone_number,
      username: form.phone_number,
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      password: form.password,
      full_name: form.full_name,
      specialization: form.specialization,
    }, { successMessage: "تم إضافة المحفظ بنجاح" });

    if (result) {
      setForm({ full_name: "", phone_number: "", password: "nooralhuda2026", specialization: "" });
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
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="h-12 rounded-xl border-slate-200" />
          {fieldErrors?.full_name && <p className="text-xs text-red-500">{fieldErrors.full_name}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">رقم الجوال</label>
          <Input type="tel" dir="ltr" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} className="h-12 rounded-xl border-slate-200" />
          {fieldErrors?.phone_number && <p className="text-xs text-red-500">{fieldErrors.phone_number}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">التخصص (اختياري)</label>
          <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} className="h-12 rounded-xl border-slate-200" />
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
 * 3. Confirm Deletion Modal — تأكيد الحذف
 */
export function ConfirmDeleteModal({
  isOpen, onClose, targetName, deleteEndpoint, onSuccess,
}: {
  isOpen: boolean; onClose: () => void; targetName: string; deleteEndpoint?: string; onSuccess?: () => void;
}) {
  const { mutate, isSubmitting } = useMutation("delete");

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
    specialization: teacher.specialization || "",
  });

  useEffect(() => {
    setForm({
      full_name: teacher.full_name,
      specialization: teacher.specialization || "",
    });
  }, [teacher]);

  const { mutate, isSubmitting, fieldErrors } = useMutation("patch");

  const handleSubmit = async () => {
    const nameParts = form.full_name.trim().split(" ");
    const result = await mutate(
      {
        first_name: nameParts[0] || "",
        last_name: nameParts.slice(1).join(" ") || "",
        specialization: form.specialization,
      },
      { endpoint: `/api/users/${teacher.id}/`, successMessage: "تم تحديث بيانات المحفظ بنجاح" }
    );
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
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="h-12 rounded-xl border-slate-200 font-medium" />
          {fieldErrors?.full_name && <p className="text-xs text-red-500">{fieldErrors.full_name}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">التخصص</label>
          <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} className="h-12 rounded-xl border-slate-200 font-medium" />
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
