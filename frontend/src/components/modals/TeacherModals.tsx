"use client";

import React, { useState } from "react";
import { Loader2, Minus, Plus, Save, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { useMutation } from "@/hooks/useMutation";
import { useQuery } from "@/hooks/useApi";
import type { MutationResource } from "@/hooks/mutations";
import type { CourseRecord, TeacherWithUser } from "@/hooks/queries";

const DAY_OPTIONS: { code: string; label: string }[] = [
  { code: "sat", label: "السبت" },
  { code: "sun", label: "الأحد" },
  { code: "mon", label: "الاثنين" },
  { code: "tue", label: "الثلاثاء" },
  { code: "wed", label: "الأربعاء" },
  { code: "thu", label: "الخميس" },
];

const ARABIC_DAY_TO_CODE: Record<string, string> = {
  السبت: "sat",
  الأحد: "sun",
  الاثنين: "mon",
  الإثنين: "mon",
  الثلاثاء: "tue",
  الأربعاء: "wed",
  الخميس: "thu",
  الجمعة: "fri",
};

const MIN_MAX_STUDENTS = 1;
const MAX_MAX_STUDENTS = 100;

function normalizeDays(value: string[] | undefined): string[] {
  if (!value) return [];
  const out: string[] = [];
  for (const raw of value) {
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    if (DAY_OPTIONS.some((d) => d.code === lower)) {
      if (!out.includes(lower)) out.push(lower);
      continue;
    }
    const code = ARABIC_DAY_TO_CODE[trimmed];
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

function DaysPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {DAY_OPTIONS.map((d) => {
        const active = value.includes(d.code);
        return (
          <button
            key={d.code}
            type="button"
            onClick={() => toggle(d.code)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-3 text-xs font-bold transition-colors",
              active
                ? "bg-primary text-white shadow-sm shadow-primary/25"
                : "bg-surface-subtle text-text-body hover:bg-border-card"
            )}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

function MaxStudentsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const clamp = (n: number) =>
    Math.max(MIN_MAX_STUDENTS, Math.min(MAX_MAX_STUDENTS, n));
  return (
    <div className="inline-flex h-12 items-center gap-2 rounded-[14px] border border-border-subtle bg-white p-1">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= MIN_MAX_STUDENTS}
        aria-label="إنقاص"
        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-subtle text-text-body transition-colors hover:bg-border-card disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={MIN_MAX_STUDENTS}
        max={MAX_MAX_STUDENTS}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(clamp(Math.round(n)));
        }}
        className="h-9 w-16 rounded-[10px] bg-transparent text-center text-base font-bold text-text-title focus:outline-none"
        aria-label="الحد الأقصى للطلاب"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= MAX_MAX_STUDENTS}
        aria-label="زيادة"
        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-subtle text-text-body transition-colors hover:bg-border-card disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function CoursesCheckboxList({
  allCourses,
  selectedIds,
  onToggle,
  loading,
}: {
  allCourses: CourseRecord[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-xs text-text-muted">جارٍ تحميل الدورات...</p>;
  }
  if (allCourses.length === 0) {
    return <p className="text-xs text-text-muted">لا توجد دورات متاحة</p>;
  }
  return (
    <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border-subtle bg-white p-2">
      {allCourses.map((c) => {
        const checked = selectedIds.includes(c.id);
        return (
          <label
            key={c.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-subtle"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(c.id)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm font-medium text-text-body">{c.name}</span>
          </label>
        );
      })}
    </div>
  );
}

export function AddTeacherModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [form, setForm] = useState({
    full_name: "",
    national_id: "",
    phone_number: "",
    specialization: "",
    affiliation: "",
    ring_name: "",
    session_days: [] as string[],
    max_students: 25,
    course_ids: [] as string[],
    wallet_name: "",
    wallet_number: "",
    birthdate: "",
    marital_status: "",
    education_qualification: "",
    last_tajweed_course: "",
    family_members_count: "",
    job_title: "teacher",
  });

  const { data: coursesData, isLoading: coursesLoading } = useQuery<CourseRecord[]>(
    isOpen ? "courses" : null
  );
  const allCourses = coursesData ?? [];
  const { mutate, isSubmitting, error, reset } = useMutation("teacher", "create");

  const toggleCourse = (id: string) => {
    setForm((f) => ({
      ...f,
      course_ids: f.course_ids.includes(id)
        ? f.course_ids.filter((x) => x !== id)
        : [...f.course_ids, id],
    }));
  };

  const handleSubmit = async () => {
    const nameParts = form.full_name.trim().split(" ");
    const result = await mutate(
      {
        national_id: form.national_id.trim(),
        phone_number: form.phone_number,
        first_name: nameParts[0] || "",
        last_name: nameParts.slice(1).join(" ") || "",
        full_name: form.full_name,
        specialization: form.specialization,
        affiliation: form.affiliation,
        ring_name: form.ring_name,
        session_days: form.session_days,
        max_students: form.max_students,
        course_ids: form.course_ids,
        wallet_name: form.wallet_name,
        wallet_number: form.wallet_number,
        birthdate: form.birthdate,
        marital_status: form.marital_status,
        education_qualification: form.education_qualification,
        last_tajweed_course: form.last_tajweed_course,
        family_members_count: form.family_members_count ? Number(form.family_members_count) : null,
        job_title: form.job_title,
      },
      { successMessage: "تم إضافة المحفظ بنجاح" }
    );
    if (result) {
      setForm({
        full_name: "",
        national_id: "",
        phone_number: "",
        specialization: "",
        affiliation: "",
        ring_name: "",
        session_days: [],
        max_students: 25,
        course_ids: [],
        wallet_name: "",
        wallet_number: "",
        birthdate: "",
        marital_status: "",
        education_qualification: "",
        last_tajweed_course: "",
        family_members_count: "",
        job_title: "teacher",
      });
      reset();
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="mb-6 text-xl font-bold text-primary">إضافة محفظ جديد</h2>

      <div className="mb-8 max-h-[60vh] space-y-4 overflow-y-auto pe-1">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الاسم الرباعي</label>
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            aria-label="الاسم الرباعي"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الهوية</label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={20}
            dir="ltr"
            value={form.national_id}
            onChange={(e) =>
              setForm({ ...form, national_id: e.target.value.replace(/\D/g, "") })
            }
            aria-label="رقم الهوية"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الجوال</label>
          <Input
            type="tel"
            dir="ltr"
            value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            aria-label="رقم الجوال"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">التخصص (اختياري)</label>
          <Input
            value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}
            aria-label="التخصص"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">اسم الحلقة</label>
          <Input
            value={form.ring_name}
            onChange={(e) => setForm({ ...form, ring_name: e.target.value })}
            aria-label="اسم الحلقة"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">التباعية</label>
          <select
            value={form.affiliation}
            onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
            aria-label="التباعية"
            className="h-12 w-full rounded-xl border border-border-subtle bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">اختر التباعية...</option>
            <option value="dar_quran">دار القرآن</option>
            <option value="awqaf">أوقاف</option>
            <option value="sheikh_tabaea">شيخ التباعية</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">اسم المحفظة (اختياري)</label>
          <Input
            value={form.wallet_name}
            onChange={(e) => setForm({ ...form, wallet_name: e.target.value })}
            aria-label="اسم المحفظة"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم المحفظة (اختياري)</label>
          <Input
            value={form.wallet_number}
            onChange={(e) => setForm({ ...form, wallet_number: e.target.value })}
            aria-label="رقم المحفظة"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">تاريخ الميلاد (اختياري)</label>
          <Input
            type="date"
            dir="ltr"
            value={form.birthdate}
            onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
            aria-label="تاريخ الميلاد"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الحالة الاجتماعية (اختياري)</label>
          <select
            value={form.marital_status}
            onChange={(e) => setForm({ ...form, marital_status: e.target.value })}
            aria-label="الحالة الاجتماعية"
            className="h-12 w-full rounded-xl border border-border-subtle bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">اختر الحالة...</option>
            <option value="single">أعزب</option>
            <option value="married">متزوج</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">المؤهل العلمي (اختياري)</label>
          <Input
            value={form.education_qualification}
            onChange={(e) => setForm({ ...form, education_qualification: e.target.value })}
            aria-label="المؤهل العلمي"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">آخر دورة تجويد (اختياري)</label>
          <Input
            value={form.last_tajweed_course}
            onChange={(e) => setForm({ ...form, last_tajweed_course: e.target.value })}
            aria-label="آخر دورة تجويد"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">عدد أفراد الأسرة (اختياري)</label>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.family_members_count}
            onChange={(e) => setForm({ ...form, family_members_count: e.target.value })}
            aria-label="عدد أفراد الأسرة"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">المسمى الوظيفي (اختياري)</label>
          <select
            value={form.job_title}
            onChange={(e) => setForm({ ...form, job_title: e.target.value })}
            aria-label="المسمى الوظيفي"
            className="h-12 w-full rounded-xl border border-border-subtle bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="teacher">محفظ</option>
            <option value="teacher_reception">محفظ استقبال</option>
            <option value="teacher_year_circle">محفظ حلقة سنة</option>
            <option value="teacher_forum_circle">محفظ حلقة منتدى</option>
            <option value="teacher_assistant">مساعد محفظ</option>
            <option value="course_instructor">معلم دورات</option>
            <option value="admin_teacher">مساعد إداري + محفظ</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-text-body">أيام الحلقة</label>
          <DaysPicker
            value={form.session_days}
            onChange={(next) => setForm({ ...form, session_days: next })}
          />
          <p className="text-[11px] text-text-muted">
            اختر الأيام التي تُقام فيها الحلقة خلال الأسبوع.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-text-body">
            الحد الأقصى للطلاب
          </label>
          <MaxStudentsStepper
            value={form.max_students}
            onChange={(n) => setForm({ ...form, max_students: n })}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الدورات</label>
          <CoursesCheckboxList
            allCourses={allCourses}
            selectedIds={form.course_ids}
            onToggle={toggleCourse}
            loading={coursesLoading}
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onClose}
          className="h-12 flex-1 rounded-xl bg-border-card/80 font-bold text-text-body hover:bg-border-subtle"
        >
          إلغاء
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-12 flex-1 gap-2 rounded-xl font-bold"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          إضافة
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Generic delete-confirmation modal. Takes a resource + id — the mutation
 * hook enqueues the delete op in the outbox so the flow works offline.
 */
export function ConfirmDeleteModal({
  isOpen,
  onClose,
  targetName,
  resource,
  targetId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  targetName: string;
  resource: MutationResource;
  targetId: string;
  onSuccess?: () => void;
}) {
  const { mutate, isSubmitting, error } = useMutation(resource, "delete");

  const handleDelete = async () => {
    if (!targetId) return;
    const result = await mutate(
      { id: targetId },
      { successMessage: "تم الحذف بنجاح" }
    );
    if (result !== null) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="pt-8 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
        <Trash2 className="h-10 w-10" />
      </div>
      <h2 className="mb-4 text-2xl font-black text-text-title">تأكيد الحذف</h2>
      <p className="mb-8 text-lg font-medium text-text-label">
        هل أنت متأكد من حذف <br />{" "}
        <span className="font-bold text-primary">{targetName}</span>؟
      </p>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
          className="h-14 flex-1 rounded-2xl bg-border-card/80 text-lg font-bold text-text-body hover:bg-border-subtle"
        >
          إلغاء
        </Button>
        <Button
          onClick={handleDelete}
          disabled={isSubmitting}
          className="h-14 flex-1 gap-2 rounded-2xl bg-[#dd1111] text-lg font-bold text-white hover:bg-[#c00f0f]"
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          نعم، احذف
        </Button>
      </div>
    </Modal>
  );
}

export function EditTeacherModal({
  isOpen,
  onClose,
  teacher,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  teacher: TeacherWithUser;
  onSuccess?: () => void;
}) {
  const [form, setForm] = useState({
    full_name: teacher.full_name,
    national_id: teacher.national_id ?? "",
    phone_number: teacher.phone_number || "",
    specialization: teacher.specialization || "",
    affiliation: teacher.affiliation || "",
    ring_name: teacher.ring_name ?? "",
    session_days: normalizeDays(teacher.session_days),
    max_students:
      typeof teacher.max_students === "number" && teacher.max_students > 0
        ? teacher.max_students
        : 25,
    course_ids: teacher.course_ids ?? [],
    wallet_name: teacher.wallet_name || "",
    wallet_number: teacher.wallet_number || "",
    birthdate: teacher.birthdate || "",
    marital_status: teacher.marital_status || "",
    education_qualification: teacher.education_qualification || "",
    last_tajweed_course: teacher.last_tajweed_course || "",
    family_members_count: teacher.family_members_count ? String(teacher.family_members_count) : "",
    job_title: teacher.job_title || "teacher",
  });

  const { data: coursesData, isLoading: coursesLoading } = useQuery<CourseRecord[]>(
    isOpen ? "courses" : null
  );
  const allCourses = coursesData ?? [];
  const { mutate, isSubmitting, error } = useMutation("teacher", "update");

  const toggleCourse = (id: string) => {
    setForm((f) => ({
      ...f,
      course_ids: f.course_ids.includes(id)
        ? f.course_ids.filter((x) => x !== id)
        : [...f.course_ids, id],
    }));
  };

  const handleSubmit = async () => {
    const nameParts = form.full_name.trim().split(" ");
    const payload: Record<string, unknown> = {
      id: teacher.id,
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      phone_number: form.phone_number,
      national_id: form.national_id.trim(),
      full_name: form.full_name,
      specialization: form.specialization,
      affiliation: form.affiliation,
      ring_name: form.ring_name,
      session_days: form.session_days,
      max_students: form.max_students,
      course_ids: form.course_ids,
      wallet_name: form.wallet_name,
      wallet_number: form.wallet_number,
      birthdate: form.birthdate,
      marital_status: form.marital_status,
      education_qualification: form.education_qualification,
      last_tajweed_course: form.last_tajweed_course,
      family_members_count: form.family_members_count ? Number(form.family_members_count) : null,
      job_title: form.job_title,
    };
    const result = await mutate(payload, {
      successMessage: "تم تحديث بيانات المحفظ بنجاح",
    });
    if (result) {
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="mb-6 text-xl font-bold text-primary">تعديل بيانات المحفظ</h2>

      <div className="mb-8 max-h-[60vh] space-y-4 overflow-y-auto pe-1">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الاسم الرباعي</label>
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            aria-label="الاسم الرباعي"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الهوية</label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={20}
            dir="ltr"
            value={form.national_id}
            onChange={(e) =>
              setForm({ ...form, national_id: e.target.value.replace(/\D/g, "") })
            }
            aria-label="رقم الهوية"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الجوال</label>
          <Input
            type="tel"
            dir="ltr"
            value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            aria-label="رقم الجوال"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">التخصص</label>
          <Input
            value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}
            aria-label="التخصص"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">اسم الحلقة</label>
          <Input
            value={form.ring_name}
            onChange={(e) => setForm({ ...form, ring_name: e.target.value })}
            aria-label="اسم الحلقة"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">التباعية</label>
          <select
            value={form.affiliation}
            onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
            aria-label="التباعية"
            className="h-12 w-full rounded-xl border border-border-subtle bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">اختر التباعية...</option>
            <option value="dar_quran">دار القرآن</option>
            <option value="awqaf">أوقاف</option>
            <option value="sheikh_tabaea">شيخ التباعية</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">اسم المحفظة (اختياري)</label>
          <Input
            value={form.wallet_name}
            onChange={(e) => setForm({ ...form, wallet_name: e.target.value })}
            aria-label="اسم المحفظة"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم المحفظة (اختياري)</label>
          <Input
            value={form.wallet_number}
            onChange={(e) => setForm({ ...form, wallet_number: e.target.value })}
            aria-label="رقم المحفظة"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">تاريخ الميلاد (اختياري)</label>
          <Input
            type="date"
            dir="ltr"
            value={form.birthdate}
            onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
            aria-label="تاريخ الميلاد"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الحالة الاجتماعية (اختياري)</label>
          <select
            value={form.marital_status}
            onChange={(e) => setForm({ ...form, marital_status: e.target.value })}
            aria-label="الحالة الاجتماعية"
            className="h-12 w-full rounded-xl border border-border-subtle bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">اختر الحالة...</option>
            <option value="single">أعزب</option>
            <option value="married">متزوج</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">المؤهل العلمي (اختياري)</label>
          <Input
            value={form.education_qualification}
            onChange={(e) => setForm({ ...form, education_qualification: e.target.value })}
            aria-label="المؤهل العلمي"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">آخر دورة تجويد (اختياري)</label>
          <Input
            value={form.last_tajweed_course}
            onChange={(e) => setForm({ ...form, last_tajweed_course: e.target.value })}
            aria-label="آخر دورة تجويد"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">عدد أفراد الأسرة (اختياري)</label>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.family_members_count}
            onChange={(e) => setForm({ ...form, family_members_count: e.target.value })}
            aria-label="عدد أفراد الأسرة"
            className="h-12 rounded-xl border-border-subtle font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">المسمى الوظيفي (اختياري)</label>
          <select
            value={form.job_title}
            onChange={(e) => setForm({ ...form, job_title: e.target.value })}
            aria-label="المسمى الوظيفي"
            className="h-12 w-full rounded-xl border border-border-subtle bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="teacher">محفظ</option>
            <option value="teacher_reception">محفظ استقبال</option>
            <option value="teacher_year_circle">محفظ حلقة سنة</option>
            <option value="teacher_forum_circle">محفظ حلقة منتدى</option>
            <option value="teacher_assistant">مساعد محفظ</option>
            <option value="course_instructor">معلم دورات</option>
            <option value="admin_teacher">مساعد إداري + محفظ</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-text-body">أيام الحلقة</label>
          <DaysPicker
            value={form.session_days}
            onChange={(next) => setForm({ ...form, session_days: next })}
          />
          <p className="text-[11px] text-text-muted">
            اختر الأيام التي تُقام فيها الحلقة خلال الأسبوع.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-text-body">
            الحد الأقصى للطلاب
          </label>
          <MaxStudentsStepper
            value={form.max_students}
            onChange={(n) => setForm({ ...form, max_students: n })}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الدورات</label>
          <CoursesCheckboxList
            allCourses={allCourses}
            selectedIds={form.course_ids}
            onToggle={toggleCourse}
            loading={coursesLoading}
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onClose}
          className="h-12 flex-1 rounded-xl bg-border-card/80 font-bold text-text-body hover:bg-border-subtle"
        >
          إلغاء
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-12 flex-[1.5] gap-2 rounded-xl font-bold"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          حفظ التعديلات
        </Button>
      </div>
    </Modal>
  );
}
