"use client";

import React, { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import { useQuery } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import type { StudentWithTeacher, TeacherWithUser } from "@/hooks/queries";

/**
 * Assign Student to Teacher Modal — تعيين الطالب لمحفظ
 */
export function AssignStudentModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  onSuccess?: () => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const { data: teachers } = useQuery<TeacherWithUser[]>(isOpen ? "teachers" : null);
  const { mutate, isSubmitting, error } = useMutation("student", "update");

  const handleSubmit = async () => {
    if (!teacherId) return;
    const result = await mutate(
      { id: studentId, teacher_id: teacherId },
      { successMessage: "تم تعيين المحفظ بنجاح" }
    );
    if (result) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-2">تعيين الطالب لمحفظ</h2>
      <p className="text-sm text-text-muted font-medium mb-6">
        تعيين الطالب: <span className="font-bold text-text-body">{studentName}</span>
      </p>

      <div className="space-y-1.5 mb-8">
        <label className="block text-sm font-bold text-text-body">اختر المحفظ</label>
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          aria-label="اختر المحفظ"
          className="h-12 w-full rounded-xl border border-border-subtle bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">— اختر المحفظ —</option>
          {(teachers ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-12 rounded-xl font-bold">
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
  isOpen,
  onClose,
  student,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  student: StudentWithTeacher;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isTeacherActor = user?.role === "teacher";
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: student.full_name,
    national_id: student.national_id,
    birthdate: student.birthdate ?? "",
    grade: student.grade,
    phone_number: student.mobile || "",
    whatsapp: student.whatsapp || "",
    address: student.address || "",
    guardian_name: student.guardian_name,
    guardian_national_id: student.guardian_national_id || "",
    guardian_mobile: student.guardian_mobile,
    bank_account_number: student.bank_account_number || "",
    bank_account_name: student.bank_account_name || "",
    bank_account_type: student.bank_account_type || "",
    current_juz: student.current_juz != null ? String(student.current_juz) : "",
    memorized_verses: String(student.memorized_verses ?? 0),
  });

  const [health, setHealth] = useState({
    martyr_son: student.health_status === "martyr_son",
    sick: student.health_status === "sick",
    injured: student.health_status === "injured",
    other: student.health_status === "other",
  });

  const [healthOtherText, setHealthOtherText] = useState(student.health_note || "");

  const skillsObj = (student.skills ?? {}) as Record<string, boolean | string>;
  const [skills, setSkills] = useState({
    quran: Boolean(skillsObj.quran),
    nasheed: Boolean(skillsObj.nasheed),
    poetry: Boolean(skillsObj.poetry),
    other: Boolean(skillsObj.other),
  });

  const [skillsOtherText, setSkillsOtherText] = useState(
    typeof skillsObj.other_text === "string" ? skillsObj.other_text : ""
  );

  const { mutate, isSubmitting: isMutating, error } = useMutation("student", "update");
  const isSubmitting = isMutating || isRequestSubmitting;

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    let health_status = "normal";
    if (health.martyr_son) health_status = "martyr_son";
    else if (health.sick) health_status = "sick";
    else if (health.injured) health_status = "injured";
    else if (health.other) health_status = "other";

    const skillsPayload = {
      ...skills,
      ...(skills.other && skillsOtherText ? { other_text: skillsOtherText } : {}),
    };
    const healthNote = health.other ? healthOtherText : "";

    const fullPayload = {
      full_name: form.full_name,
      national_id: form.national_id,
      birthdate: form.birthdate,
      grade: form.grade,
      mobile: form.phone_number,
      whatsapp: form.whatsapp,
      address: form.address,
      guardian_name: form.guardian_name,
      guardian_national_id: form.guardian_national_id,
      guardian_mobile: form.guardian_mobile,
      bank_account_number: form.bank_account_number,
      bank_account_name: form.bank_account_name,
      bank_account_type: form.bank_account_type,
      health_status,
      health_note: healthNote,
      skills: skillsPayload,
      current_juz: form.current_juz ? Number(form.current_juz) : null,
      memorized_verses: Number(form.memorized_verses || 0),
    };

    if (isTeacherActor) {
      // Teachers can no longer write to a student's record directly — this
      // submits a pending StudentChangeRequest (action=update) instead,
      // which only takes effect once an admin approves it. Direct online
      // call, same pattern as AnnounceModal — not part of the Dexie outbox.
      setIsRequestSubmitting(true);
      const res = await api.post("/api/students/teacher-requests/", {
        action: "update",
        student_id: student.id,
        payload: fullPayload,
      });
      setIsRequestSubmitting(false);
      if (!res.success) {
        showToast(res.error.message, "error");
        return;
      }
      showToast("تم إرسال طلب التعديل، بانتظار موافقة الإدارة", "success");
      onSuccess?.();
      return;
    }

    const result = await mutate(
      { id: student.id, ...fullPayload },
      { successMessage: "تم تحديث بيانات الطالب بنجاح" }
    );
    if (result) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-2">تعديل بيانات الطالب</h2>
      <p className="text-sm text-text-muted mb-6">
        {isTeacherActor
          ? "سيُرسَل التعديل كطلب بانتظار موافقة الإدارة."
          : `تعديل بيانات: ${student.full_name}`}
      </p>

      <div className="space-y-4 mb-8 max-h-96 overflow-y-auto">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الاسم رباعي</label>
          <Input value={form.full_name} onChange={(e) => handleChange("full_name", e.target.value)} aria-label="الاسم رباعي" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الهوية</label>
          <Input type="number" dir="ltr" value={form.national_id} onChange={(e) => handleChange("national_id", e.target.value)} aria-label="رقم الهوية" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-body">تاريخ الميلاد</label>
            <Input type="date" value={form.birthdate} onChange={(e) => handleChange("birthdate", e.target.value)} aria-label="تاريخ الميلاد" className="h-12 rounded-xl border-border-subtle" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-body">الصف الدراسي</label>
            <select
              value={form.grade}
              onChange={(e) => handleChange("grade", e.target.value)}
              aria-label="الصف الدراسي"
              className="h-12 w-full rounded-xl border border-border-subtle bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={String(i + 1)}>الصف {i + 1}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الجوال</label>
          <Input type="tel" dir="ltr" value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} aria-label="رقم الجوال" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">واتساب</label>
          <Input type="tel" dir="ltr" value={form.whatsapp} onChange={(e) => handleChange("whatsapp", e.target.value)} aria-label="واتساب" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">العنوان</label>
          <Input value={form.address} onChange={(e) => handleChange("address", e.target.value)} aria-label="العنوان" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">اسم ولي الأمر</label>
          <Input value={form.guardian_name} onChange={(e) => handleChange("guardian_name", e.target.value)} aria-label="اسم ولي الأمر" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم هوية ولي الأمر</label>
          <Input type="number" dir="ltr" value={form.guardian_national_id} onChange={(e) => handleChange("guardian_national_id", e.target.value)} aria-label="رقم هوية ولي الأمر" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">جوال ولي الأمر</label>
          <Input type="tel" dir="ltr" value={form.guardian_mobile} onChange={(e) => handleChange("guardian_mobile", e.target.value)} aria-label="جوال ولي الأمر" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الحساب</label>
          <Input value={form.bank_account_number} onChange={(e) => handleChange("bank_account_number", e.target.value)} aria-label="رقم الحساب" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">اسم الحساب</label>
          <Input value={form.bank_account_name} onChange={(e) => handleChange("bank_account_name", e.target.value)} aria-label="اسم الحساب" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">نوع الحساب</label>
          <Input value={form.bank_account_type} onChange={(e) => handleChange("bank_account_type", e.target.value)} aria-label="نوع الحساب" className="h-12 rounded-xl border-border-subtle" />
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-sm font-bold text-text-body">الحالة الصحية</label>
          <div className="grid grid-cols-2 gap-3">
            {([["martyr_son", "ابن شهيد"], ["sick", "مريض"], ["injured", "جريح"], ["other", "أخرى"]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={health[key]} onChange={() => setHealth({ martyr_son: false, sick: false, injured: false, other: false, [key]: !health[key] })} className="w-4 h-4 rounded accent-secondary" />
                <span className="text-sm text-text-body">{label}</span>
              </label>
            ))}
          </div>
          {health.other && (
            <div className="mt-2 animate-in fade-in slide-in-from-top-1">
              <Input
                placeholder="يرجى توضيح الحالة الصحية..."
                value={healthOtherText}
                onChange={(e) => setHealthOtherText(e.target.value)}
                className="h-10 text-sm rounded-lg border-border-subtle"
              />
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-sm font-bold text-text-body">المهارات والاهتمامات</label>
          <div className="grid grid-cols-2 gap-3">
            {([["quran", "قراءات قرآن"], ["nasheed", "إنشاد"], ["poetry", "شعر"], ["other", "أخرى"]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={skills[key]} onChange={() => setSkills({ ...skills, [key]: !skills[key] })} className="w-4 h-4 rounded accent-secondary" />
                <span className="text-sm text-text-body">{label}</span>
              </label>
            ))}
          </div>
          {skills.other && (
            <div className="mt-2 animate-in fade-in slide-in-from-top-1">
              <Input
                placeholder="يرجى توضيح المهارات الأخرى..."
                value={skillsOtherText}
                onChange={(e) => setSkillsOtherText(e.target.value)}
                className="h-10 text-sm rounded-lg border-border-subtle"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-body">الجزء الحالي</label>
            <Input type="number" dir="ltr" value={form.current_juz} onChange={(e) => handleChange("current_juz", e.target.value)} aria-label="الجزء الحالي" className="h-12 rounded-xl border-border-subtle" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-body">عدد الصفحات المحفوظة</label>
            <Input type="number" dir="ltr" value={form.memorized_verses} onChange={(e) => handleChange("memorized_verses", e.target.value)} aria-label="عدد الصفحات المحفوظة" className="h-12 rounded-xl border-border-subtle" />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-12 rounded-xl font-bold">
          إلغاء
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-[1.5] h-12 rounded-xl font-bold gap-2">
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isTeacherActor ? "إرسال طلب التعديل" : "حفظ التعديلات"}
        </Button>
      </div>
    </Modal>
  );
}
