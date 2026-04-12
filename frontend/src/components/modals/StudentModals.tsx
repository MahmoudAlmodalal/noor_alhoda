"use client";

import React, { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import { useApi } from "@/hooks/useApi";
import type { Teacher, Student } from "@/types/api";

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
  const { mutate, isSubmitting, error } = useMutation("patch");

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
          aria-label="اختر المحفظ"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">— اختر المحفظ —</option>
          {(teachers ?? []).map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-4">{error}</p>
      )}

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

/**
 * Edit Student Modal — تعديل بيانات الطالب
 */
export function EditStudentModal({
  isOpen, onClose, student, onSuccess,
}: {
  isOpen: boolean; onClose: () => void; student: Student; onSuccess?: () => void;
}) {
  const [form, setForm] = useState({
    full_name: student.full_name,
    national_id: student.national_id,
    birthdate: student.birthdate,
    grade: student.grade,
    phone_number: student.mobile || "",
    address: student.address || "",
    guardian_name: student.guardian_name,
    guardian_national_id: student.guardian_national_id || "",
    guardian_mobile: student.guardian_mobile,
  });

  const [health, setHealth] = useState({
    martyr_son: student.health_status === "martyr_son",
    sick: student.health_status === "sick",
    injured: student.health_status === "injured",
    other: student.health_status === "other",
  });

  const [skills, setSkills] = useState({
    quran: student.skills?.quran ?? false,
    nasheed: student.skills?.nasheed ?? false,
    poetry: student.skills?.poetry ?? false,
    other: student.skills?.other ?? false,
  });

  const { mutate, isSubmitting, fieldErrors, error } = useMutation("patch");

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const getFieldError = (name: string): string | undefined => {
    if (!fieldErrors) return undefined;
    const err = fieldErrors[name];
    if (Array.isArray(err)) return err[0];
    if (typeof err === "string") return err;
    return undefined;
  };

  const handleSubmit = async () => {
    let health_status = "normal";
    if (health.martyr_son) health_status = "martyr_son";
    else if (health.sick) health_status = "sick";
    else if (health.injured) health_status = "injured";
    else if (health.other) health_status = "other";

    const result = await mutate(
      {
        full_name: form.full_name,
        national_id: form.national_id,
        birthdate: form.birthdate,
        grade: form.grade,
        mobile: form.phone_number,
        address: form.address,
        guardian_name: form.guardian_name,
        guardian_national_id: form.guardian_national_id,
        guardian_mobile: form.guardian_mobile,
        health_status,
        skills,
      },
      { endpoint: `/api/students/${student.id}/`, successMessage: "تم تحديث بيانات الطالب بنجاح" }
    );
    if (result) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-6">تعديل بيانات الطالب</h2>

      <div className="space-y-4 mb-8 max-h-96 overflow-y-auto">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">الاسم الرباعي</label>
          <Input value={form.full_name} onChange={(e) => handleChange("full_name", e.target.value)} aria-label="الاسم الرباعي" className="h-12 rounded-xl border-slate-200" />
          {getFieldError("full_name") && <p className="text-xs text-red-500">{getFieldError("full_name")}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">رقم الهوية</label>
          <Input type="number" dir="ltr" value={form.national_id} onChange={(e) => handleChange("national_id", e.target.value)} aria-label="رقم الهوية" className="h-12 rounded-xl border-slate-200" />
          {getFieldError("national_id") && <p className="text-xs text-red-500">{getFieldError("national_id")}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">تاريخ الميلاد</label>
          <Input type="date" value={form.birthdate} onChange={(e) => handleChange("birthdate", e.target.value)} aria-label="تاريخ الميلاد" className="h-12 rounded-xl border-slate-200" />
          {getFieldError("birthdate") && <p className="text-xs text-red-500">{getFieldError("birthdate")}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">الصف الدراسي</label>
          <Input value={form.grade} onChange={(e) => handleChange("grade", e.target.value)} aria-label="الصف الدراسي" className="h-12 rounded-xl border-slate-200" />
          {getFieldError("grade") && <p className="text-xs text-red-500">{getFieldError("grade")}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">رقم الجوال</label>
          <Input type="tel" dir="ltr" value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} aria-label="رقم الجوال" className="h-12 rounded-xl border-slate-200" />
          {getFieldError("phone_number") && <p className="text-xs text-red-500">{getFieldError("phone_number")}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">عنوان السكن</label>
          <Input value={form.address} onChange={(e) => handleChange("address", e.target.value)} aria-label="عنوان السكن" className="h-12 rounded-xl border-slate-200" />
          {getFieldError("address") && <p className="text-xs text-red-500">{getFieldError("address")}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">اسم ولي الأمر</label>
          <Input value={form.guardian_name} onChange={(e) => handleChange("guardian_name", e.target.value)} aria-label="اسم ولي الأمر" className="h-12 rounded-xl border-slate-200" />
          {getFieldError("guardian_name") && <p className="text-xs text-red-500">{getFieldError("guardian_name")}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">رقم هوية ولي الأمر</label>
          <Input type="number" dir="ltr" value={form.guardian_national_id} onChange={(e) => handleChange("guardian_national_id", e.target.value)} aria-label="رقم هوية ولي الأمر" className="h-12 rounded-xl border-slate-200" />
          {getFieldError("guardian_national_id") && <p className="text-xs text-red-500">{getFieldError("guardian_national_id")}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">جوال ولي الأمر</label>
          <Input type="tel" dir="ltr" value={form.guardian_mobile} onChange={(e) => handleChange("guardian_mobile", e.target.value)} aria-label="جوال ولي الأمر" className="h-12 rounded-xl border-slate-200" />
          {getFieldError("guardian_mobile") && <p className="text-xs text-red-500">{getFieldError("guardian_mobile")}</p>}
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-sm font-bold text-slate-800">الحالة الصحية</label>
          <div className="grid grid-cols-2 gap-3">
            {([["martyr_son", "ابن شهيد"], ["sick", "مريض"], ["injured", "ابن أسير"], ["other", "أخرى"]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={health[key]} onChange={() => setHealth({ martyr_son: false, sick: false, injured: false, other: false, [key]: !health[key] })} className="w-4 h-4 rounded accent-[#eabd5b]" />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-sm font-bold text-slate-800">المهارات والاهتمامات</label>
          <div className="grid grid-cols-2 gap-3">
            {([["quran", "قراءات قرآن"], ["nasheed", "إنشاد"], ["poetry", "شعر"], ["other", "أخرى"]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={skills[key]} onChange={() => setSkills({ ...skills, [key]: !skills[key] })} className="w-4 h-4 rounded accent-[#eabd5b]" />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
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
