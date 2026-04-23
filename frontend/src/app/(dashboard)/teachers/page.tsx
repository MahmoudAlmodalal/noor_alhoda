"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, UserPlus, UserX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useQuery } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import type { StudentWithTeacher, TeacherWithUser } from "@/hooks/queries";
import { TeachersHeroStats } from "@/components/teachers/TeachersHeroStats";
import { TeacherCard } from "@/components/teachers/TeacherCard";
import {
  AddTeacherModal,
  ConfirmDeleteModal,
  EditTeacherModal,
} from "@/components/modals/TeacherModals";
import { RoleGate } from "@/components/auth/RoleGate";

const PAGE_SIZE = 12;

const DAY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "كل الأيام" },
  { value: "sat", label: "السبت" },
  { value: "sun", label: "الأحد" },
  { value: "mon", label: "الاثنين" },
  { value: "tue", label: "الثلاثاء" },
  { value: "wed", label: "الأربعاء" },
  { value: "thu", label: "الخميس" },
];

const ARABIC_DAY_TO_CODE: Record<string, string> = {
  السبت: "sat",
  الأحد: "sun",
  الاثنين: "mon",
  الإثنين: "mon",
  الثلاثاء: "tue",
  الأربعاء: "wed",
  الخميس: "thu",
};

function matchesDay(sessionDays: string[] | undefined, dayCode: string): boolean {
  if (!dayCode) return true;
  if (!sessionDays?.length) return false;
  return sessionDays.some((d) => {
    const trimmed = d.trim();
    if (trimmed.toLowerCase() === dayCode) return true;
    if (ARABIC_DAY_TO_CODE[trimmed] === dayCode) return true;
    return false;
  });
}

function TeachersPageInner() {
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);

  const { data: teachers, isLoading } = useQuery<TeacherWithUser[]>("teachers");
  const { data: students } = useQuery<StudentWithTeacher[]>("students_with_teacher");

  const [showAdd, setShowAdd] = useState(false);
  const [editTeacher, setEditTeacher] = useState<TeacherWithUser | null>(null);
  const [deleteTeacher, setDeleteTeacher] = useState<TeacherWithUser | null>(null);

  const studentsByTeacher = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of students ?? []) {
      if (!s.teacher_id) continue;
      map.set(s.teacher_id, (map.get(s.teacher_id) ?? 0) + 1);
    }
    return map;
  }, [students]);

  const totalAssignedStudents = useMemo(() => {
    return (students ?? []).filter((s) => Boolean(s.teacher_id)).length;
  }, [students]);

  const activeHalaqas = useMemo(() => {
    const set = new Set<string>();
    for (const t of teachers ?? []) {
      const name = (t.ring_name ?? "").trim();
      if (name) set.add(name);
    }
    return set.size;
  }, [teachers]);

  const filtered = useMemo(() => {
    const all = teachers ?? [];
    const q = debouncedSearch.trim().toLowerCase();
    let result = all;
    if (q) {
      result = result.filter(
        (t) =>
          t.full_name.toLowerCase().includes(q) ||
          (t.national_id ?? "").toLowerCase().includes(q) ||
          (t.ring_name ?? "").toLowerCase().includes(q)
      );
    }
    if (dayFilter) {
      result = result.filter((t) => matchesDay(t.session_days, dayFilter));
    }
    return result
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
  }, [teachers, debouncedSearch, dayFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (isLoading && !teachers) return <PageLoading />;

  const hasAnyTeachers = (teachers ?? []).length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <TeachersHeroStats
        teachersCount={(teachers ?? []).length}
        assignedStudentsCount={totalAssignedStudents}
        activeHalaqasCount={activeHalaqas}
      />

      <div className="flex flex-col gap-3 rounded-[24px] border border-border-card bg-white p-4 shadow-sm md:flex-row md:items-center md:gap-3">
        <div className="flex-1">
          <Input
            icon={<Search className="h-5 w-5" />}
            placeholder="ابحث بالاسم أو رقم الهوية أو اسم الحلقة..."
            className="h-12 rounded-[14px] bg-surface-subtle"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="البحث عن محفظ"
          />
        </div>
        <select
          value={dayFilter}
          onChange={(e) => {
            setDayFilter(e.target.value);
            setPage(1);
          }}
          aria-label="فلترة حسب يوم الحلقة"
          className="h-12 rounded-[14px] border border-[#e5e7eb] bg-surface-subtle px-4 text-sm font-medium text-text-body focus:outline-none focus:ring-2 focus:ring-primary/20 md:w-48"
        >
          {DAY_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          onClick={() => setShowAdd(true)}
          className="h-12 gap-2 rounded-[14px] px-5 font-bold"
        >
          <UserPlus className="h-5 w-5" />
          إضافة محفظ
        </Button>
      </div>

      {hasAnyTeachers ? (
        <div className="flex items-center justify-between rounded-[16px] border border-border-card bg-white px-4 py-2.5 text-sm text-text-muted shadow-sm">
          <span>
            عرض <span className="font-bold text-text-title">{visible.length}</span> من{" "}
            <span className="font-bold text-text-title">{filtered.length}</span> محفظ
          </span>
          {totalPages > 1 ? (
            <span className="text-xs">
              الصفحة {safePage} من {totalPages}
            </span>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          hasFilters={Boolean(debouncedSearch || dayFilter)}
          onClearFilters={() => {
            setSearch("");
            setDayFilter("");
            setPage(1);
          }}
          onAdd={() => setShowAdd(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((teacher, idx) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              studentsCount={studentsByTeacher.get(teacher.id) ?? 0}
              onEdit={() => setEditTeacher(teacher)}
              onDelete={() => setDeleteTeacher(teacher)}
              animationDelay={idx * 40}
            />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <PaginationBar
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}

      <AddTeacherModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => setShowAdd(false)}
      />

      {editTeacher ? (
        <EditTeacherModal
          isOpen={!!editTeacher}
          onClose={() => setEditTeacher(null)}
          teacher={editTeacher}
          onSuccess={() => setEditTeacher(null)}
        />
      ) : null}

      {deleteTeacher ? (
        <ConfirmDeleteModal
          isOpen={!!deleteTeacher}
          onClose={() => setDeleteTeacher(null)}
          targetName={deleteTeacher.full_name}
          resource="teacher"
          targetId={deleteTeacher.id}
          onSuccess={() => setDeleteTeacher(null)}
        />
      ) : null}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
  onAdd,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-border-card bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-tile-blue">
        <UserX className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mb-1 text-lg font-bold text-text-title">
        {hasFilters ? "لا توجد نتائج مطابقة" : "لا يوجد محفظون بعد"}
      </h3>
      <p className="mb-5 text-sm text-text-muted">
        {hasFilters
          ? "جرّب تعديل كلمة البحث أو إزالة الفلاتر لرؤية المزيد."
          : "ابدأ بإضافة أول محفظ لإدارة الحلقات."}
      </p>
      <div className="flex items-center justify-center gap-2">
        {hasFilters ? (
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="h-11 rounded-[12px] px-5 font-bold"
          >
            مسح الفلاتر
          </Button>
        ) : null}
        <Button
          onClick={onAdd}
          className="h-11 gap-2 rounded-[12px] px-5 font-bold"
        >
          <UserPlus className="h-4 w-4" />
          إضافة محفظ جديد
        </Button>
      </div>
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[16px] border border-border-card bg-white px-4 py-3 shadow-sm">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 rounded-[10px] border border-border-subtle px-3 py-2 text-sm font-semibold text-text-body transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
        السابق
      </button>
      <span className="text-sm font-bold text-text-title">
        صفحة {page} من {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 rounded-[10px] border border-border-subtle px-3 py-2 text-sm font-semibold text-text-body transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
      >
        التالي
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function TeachersPage() {
  return (
    <RoleGate roles={["admin"]}>
      <TeachersPageInner />
    </RoleGate>
  );
}
