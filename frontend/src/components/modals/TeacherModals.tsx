"use client";

import React, { useState } from "react";
import { Trash2, Save, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import { useQuery } from "@/hooks/useApi";
import type { MutationResource } from "@/hooks/mutations";
import type { CourseRecord, TeacherWithUser } from "@/hooks/queries";

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
    <div className="max-h-40 overflow-y-auto rounded-xl border border-border-subtle bg-white p-2 space-y-1">
      {allCourses.map((c) => {
        const checked = selectedIds.includes(c.id);
        return (
          <label
            key={c.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-subtle cursor-pointer"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(c.id)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-text-body font-medium">{c.name}</span>
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
    course_ids: [] as string[],
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
        course_ids: form.course_ids,
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
        course_ids: [],
      });
      reset();
      onSuccess?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-primary mb-6">إضافة محفظ جديد</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الاسم الرباعي</label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} aria-label="الاسم الرباعي" className="h-12 rounded-xl border-border-subtle" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الهوية</label>
          <Input type="number" dir="ltr" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} aria-label="رقم الهوية" className="h-12 rounded-xl border-border-subtle" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الجوال</label>
          <Input type="tel" dir="ltr" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} aria-label="رقم الجوال" className="h-12 rounded-xl border-border-subtle" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">التخصص (اختياري)</label>
          <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} aria-label="التخصص" className="h-12 rounded-xl border-border-subtle" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">اسم الحلقة</label>
          <Input value={form.ring_name} onChange={(e) => setForm({ ...form, ring_name: e.target.value })} aria-label="اسم الحلقة" className="h-12 rounded-xl border-border-subtle" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">التباعية</label>
          <select
            value={form.affiliation}
            onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
            aria-label="التباعية"
            className="w-full h-12 rounded-xl border border-border-subtle px-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">اختر التباعية...</option>
            <option value="dar_quran">دار القرآن</option>
            <option value="awqaf">أوقاف</option>
            <option value="sheikh_tabaea">شيخ التباعية</option>
          </select>
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

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-12 rounded-xl font-bold">
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
    <Modal isOpen={isOpen} onClose={onClose} className="text-center pt-8">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <Trash2 className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-black text-text-title mb-4">تأكيد الحذف</h2>
      <p className="text-lg text-text-label font-medium mb-8">
        هل أنت متأكد من حذف <br /> <span className="font-bold text-primary">{targetName}</span>؟
      </p>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-14 rounded-2xl font-bold text-lg">
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
    course_ids: [] as string[],
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
      course_ids: form.course_ids,
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
      <h2 className="text-xl font-bold text-primary mb-6">تعديل بيانات المحفظ</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">الاسم الرباعي</label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} aria-label="الاسم الرباعي" className="h-12 rounded-xl border-border-subtle font-medium" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الهوية</label>
          <Input type="number" dir="ltr" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} aria-label="رقم الهوية" className="h-12 rounded-xl border-border-subtle font-medium" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">رقم الجوال</label>
          <Input type="tel" dir="ltr" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} aria-label="رقم الجوال" className="h-12 rounded-xl border-border-subtle font-medium" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">التخصص</label>
          <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} aria-label="التخصص" className="h-12 rounded-xl border-border-subtle font-medium" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">اسم الحلقة</label>
          <Input value={form.ring_name} onChange={(e) => setForm({ ...form, ring_name: e.target.value })} aria-label="اسم الحلقة" className="h-12 rounded-xl border-border-subtle font-medium" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">التباعية</label>
          <select
            value={form.affiliation}
            onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
            aria-label="التباعية"
            className="w-full h-12 rounded-xl border border-border-subtle px-3 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">اختر التباعية...</option>
            <option value="dar_quran">دار القرآن</option>
            <option value="awqaf">أوقاف</option>
            <option value="sheikh_tabaea">شيخ التباعية</option>
          </select>
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

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-12 rounded-xl font-bold">
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
