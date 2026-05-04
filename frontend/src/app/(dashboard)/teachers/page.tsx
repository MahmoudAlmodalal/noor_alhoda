"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileDown, Search, Upload, UserPlus, UserX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { PaginationBar } from "@/components/ui/PaginationBar";
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
import { api } from "@/lib/api";
import { emitChanges } from "@/lib/db/events";
import { pullSync } from "@/lib/sync/runner";
import { useToast } from "@/contexts/ToastContext";

interface TeacherImportError {
  row: number;
  national_id: string | null;
  message: string;
}

interface TeacherImportResult {
  created_count: number;
  updated_count: number;
  error_count: number;
  errors: TeacherImportError[];
}

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

  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<TeacherImportError[] | null>(null);

  const downloadXlsx = async (endpoint: string, filename: string) => {
    const blob = await api.downloadBlob(endpoint);
    if (!blob) {
      showToast("تعذّر تنزيل الملف.", "error");
      return;
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExportXlsx = async () => {
    const today = new Date().toISOString().slice(0, 10);
    await downloadXlsx("/api/users/teachers/export/", `teachers-${today}.xlsx`);
  };

  const handleDownloadTemplate = async () => {
    await downloadXlsx("/api/users/teachers/template/", "teachers-template.xlsx");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    try {
      const res = await api.uploadFile<TeacherImportResult>(
        "/api/users/teachers/import-xlsx/",
        file
      );
      if (!res.success) {
        showToast(res.error.message || "فشل استيراد الملف.", "error");
        return;
      }
      const result = res.data;
      const created = result.created_count;
      const updated = result.updated_count;
      const errCount = result.error_count;

      // Pull from server so the offline DB reflects the new rows, then ping
      // change subscribers so the page refetches.
      try {
        await pullSync();
      } catch {
        // Pull failure is non-fatal — emitChanges below still triggers a
        // refetch from the local DB next time it syncs.
      }
      emitChanges(["teacher", "course"]);

      const summary = `تم: ${created} إضافة، ${updated} تحديث، ${errCount} خطأ.`;
      showToast(summary, errCount > 0 ? "info" : "success");
      if (errCount > 0) setImportErrors(result.errors);
    } finally {
      setIsImporting(false);
    }
  };

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
          variant="outline"
          onClick={handleDownloadTemplate}
          className="h-12 gap-2 rounded-[14px] px-4 font-bold"
          aria-label="تحميل قالب Excel"
        >
          <FileDown className="h-5 w-5" />
          تحميل القالب
        </Button>
        <Button
          variant="outline"
          onClick={handleExportXlsx}
          className="h-12 gap-2 rounded-[14px] px-4 font-bold"
          aria-label="تصدير قائمة المحفظين إلى Excel"
        >
          <Download className="h-5 w-5" />
          تصدير
        </Button>
        <Button
          variant="outline"
          onClick={handleImportClick}
          disabled={isImporting}
          className="h-12 gap-2 rounded-[14px] px-4 font-bold"
          aria-label="استيراد المحفظين من Excel"
        >
          <Upload className="h-5 w-5" />
          {isImporting ? "جاري الاستيراد..." : "استيراد"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={handleImportFile}
        />
        <Button
          onClick={() => setShowAdd(true)}
          className="h-12 gap-2 rounded-[14px] px-5 font-bold"
        >
          <UserPlus className="h-5 w-5" />
          إضافة محفظ
        </Button>
      </div>

      {importErrors ? (
        <ImportErrorsModal
          errors={importErrors}
          onClose={() => setImportErrors(null)}
        />
      ) : null}

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

function ImportErrorsModal({
  errors,
  onClose,
}: {
  errors: TeacherImportError[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl md:p-8">
        <h3 className="mb-1 text-lg font-bold text-text-title">
          صفوف لم يتم استيرادها
        </h3>
        <p className="mb-4 text-sm text-text-muted">
          تم تخطي الصفوف التالية. يمكنك تصحيحها في الملف وإعادة الاستيراد.
        </p>
        <div className="max-h-80 overflow-auto rounded-[14px] border border-border-card">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface-subtle text-text-muted">
              <tr>
                <th className="p-2 font-bold">الصف</th>
                <th className="p-2 font-bold">رقم الهوية</th>
                <th className="p-2 font-bold">الخطأ</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((err) => (
                <tr key={`${err.row}-${err.national_id ?? ""}`} className="border-t border-border-card">
                  <td className="p-2 align-top">{err.row}</td>
                  <td className="p-2 align-top">{err.national_id ?? "—"}</td>
                  <td className="p-2 align-top text-text-body">{err.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={onClose} className="h-11 rounded-[12px] px-5 font-bold">
            إغلاق
          </Button>
        </div>
      </div>
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
