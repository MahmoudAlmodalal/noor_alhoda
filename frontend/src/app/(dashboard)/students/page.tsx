"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Search, UserPlus, UserX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import type {
  CourseRecord,
  StudentWithTeacher,
  TeacherWithUser,
} from "@/hooks/queries";
import type { StudentsOverviewStats } from "@/lib/db/repos/aggregates";
import { api } from "@/lib/api";
import { StudentsHeroStats } from "@/components/students/StudentsHeroStats";
import { StudentCard } from "@/components/students/StudentCard";
import {
  AssignStudentModal,
  EditStudentModal,
} from "@/components/modals/StudentModals";
import { ConfirmDeleteModal } from "@/components/modals/TeacherModals";
import {
  RequestAssignStudentModal,
  RequestDeleteStudentModal,
  RequestRemoveTeacherModal,
} from "@/components/modals/ChangeRequestModals";

const PAGE_SIZE = 12;

const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `الصف ${i + 1}`,
}));

export default function StudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const canFilterByCourse = user?.role === "admin" || user?.role === "teacher";

  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);

  const { data: teachers } = useQuery<TeacherWithUser[]>(
    isAdmin ? "teachers" : null
  );
  const { data: courses } = useQuery<CourseRecord[]>(
    canFilterByCourse ? "courses" : null
  );
  const { data: overviewStats } = useQuery<StudentsOverviewStats>(
    "students_overview_stats"
  );

  const queryParams = useMemo(() => {
    const p: Record<string, string | undefined> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (isAdmin && teacherFilter) p.teacher_id = teacherFilter;
    if (canFilterByCourse && courseFilter) p.course_id = courseFilter;
    if (gradeFilter) p.grade = gradeFilter;
    return p;
  }, [
    debouncedSearch,
    isAdmin,
    teacherFilter,
    canFilterByCourse,
    courseFilter,
    gradeFilter,
  ]);

  const { data: allStudents, isLoading } = useQuery<StudentWithTeacher[]>(
    "students_with_teacher",
    queryParams
  );

  const sorted = useMemo(() => {
    const arr = (allStudents ?? []).slice();
    arr.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
    return arr;
  }, [allStudents]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = sorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const [assignStudent, setAssignStudent] =
    useState<StudentWithTeacher | null>(null);
  const [editStudent, setEditStudent] = useState<StudentWithTeacher | null>(null);
  const [deleteStudent, setDeleteStudent] =
    useState<StudentWithTeacher | null>(null);
  const [removeRequestTarget, setRemoveRequestTarget] =
    useState<StudentWithTeacher | null>(null);
  const [deleteRequestTarget, setDeleteRequestTarget] =
    useState<StudentWithTeacher | null>(null);
  const [showAssignRequestModal, setShowAssignRequestModal] = useState(false);

  const hasFilters = Boolean(
    debouncedSearch || teacherFilter || courseFilter || gradeFilter
  );

  const handleClearFilters = () => {
    setSearch("");
    setTeacherFilter("");
    setCourseFilter("");
    setGradeFilter("");
    setPage(1);
  };

  const handleExportXlsx = async () => {
    const params = new URLSearchParams();
    if (queryParams.search) params.set("search", queryParams.search);
    if (queryParams.teacher_id) params.set("teacher_id", queryParams.teacher_id);
    if (queryParams.course_id) params.set("course_id", queryParams.course_id);
    if (queryParams.grade) params.set("grade", queryParams.grade);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const blob = await api.downloadBlob(`/api/students/export/${qs}`);
    if (!blob) return;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `students-${today}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async (student: StudentWithTeacher) => {
    const blob = await api.downloadBlob(
      `/api/reports/student/${student.id}/pdf/`
    );
    if (!blob) return;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `تقرير_${student.full_name}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading && !allStudents) {
    return <PageLoading />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <StudentsHeroStats
        totalCount={overviewStats?.total ?? sorted.length}
        presentTodayCount={overviewStats?.present_today ?? 0}
        unassignedCount={overviewStats?.unassigned ?? 0}
      />

      <div className="flex flex-col gap-3 rounded-[24px] border border-border-card bg-white p-4 shadow-sm md:flex-row md:flex-wrap md:items-center md:gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            icon={<Search className="h-5 w-5" />}
            placeholder="ابحث بالاسم أو رقم الهوية..."
            className="h-12 rounded-[14px] bg-surface-subtle"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="البحث عن طالب"
          />
        </div>

        {canFilterByCourse ? (
          <select
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value);
              setPage(1);
            }}
            aria-label="فلترة حسب الدورة"
            className="h-12 rounded-[14px] border border-[#e5e7eb] bg-surface-subtle px-4 text-sm font-medium text-text-body focus:outline-none focus:ring-2 focus:ring-primary/20 md:w-44"
          >
            <option value="">كل الدورات</option>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}

        {isAdmin ? (
          <select
            value={teacherFilter}
            onChange={(e) => {
              setTeacherFilter(e.target.value);
              setPage(1);
            }}
            aria-label="فلترة حسب المحفظ"
            className="h-12 rounded-[14px] border border-[#e5e7eb] bg-surface-subtle px-4 text-sm font-medium text-text-body focus:outline-none focus:ring-2 focus:ring-primary/20 md:w-44"
          >
            <option value="">كل المحفظين</option>
            {(teachers ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        ) : null}

        <select
          value={gradeFilter}
          onChange={(e) => {
            setGradeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="فلترة حسب الصف"
          className="h-12 rounded-[14px] border border-[#e5e7eb] bg-surface-subtle px-4 text-sm font-medium text-text-body focus:outline-none focus:ring-2 focus:ring-primary/20 md:w-36"
        >
          <option value="">كل الصفوف</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>

        {isAdmin ? (
          <>
            <Button
              onClick={handleExportXlsx}
              variant="outline"
              className="h-12 gap-2 rounded-[14px] px-4 font-bold"
            >
              <FileSpreadsheet className="h-5 w-5" />
              تصدير Excel
            </Button>
            <Button
              onClick={() => router.push("/students/register")}
              className="h-12 gap-2 rounded-[14px] px-5 font-bold"
            >
              <UserPlus className="h-5 w-5" />
              إضافة طالب
            </Button>
          </>
        ) : null}

        {isTeacher ? (
          <>
            <Button
              onClick={() => router.push("/students/register")}
              variant="outline"
              className="h-12 gap-2 rounded-[14px] px-4 font-bold"
            >
              <UserPlus className="h-5 w-5" />
              تسجيل طالب
            </Button>
            <Button
              onClick={() => setShowAssignRequestModal(true)}
              className="h-12 gap-2 rounded-[14px] px-5 font-bold"
            >
              <UserPlus className="h-5 w-5" />
              طلب ضم طالب
            </Button>
          </>
        ) : null}
      </div>

      {sorted.length > 0 ? (
        <div className="flex items-center justify-between rounded-[16px] border border-border-card bg-white px-4 py-2.5 text-sm text-text-muted shadow-sm">
          <span>
            عرض{" "}
            <span className="font-bold text-text-title">{visible.length}</span> من{" "}
            <span className="font-bold text-text-title">{sorted.length}</span>{" "}
            طالب
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
          hasFilters={hasFilters}
          onClearFilters={handleClearFilters}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((student, idx) => (
            <StudentCard
              key={student.id}
              student={student}
              canEdit={isAdmin || isTeacher}
              canDelete={isAdmin}
              onAssignTeacher={
                isAdmin ? () => setAssignStudent(student) : undefined
              }
              onRequestRemoveTeacher={
                isTeacher && student.teacher_id === user?.teacher_profile?.id
                  ? () => setRemoveRequestTarget(student)
                  : undefined
              }
              onRequestDelete={
                isTeacher && student.teacher_id === user?.teacher_profile?.id
                  ? () => setDeleteRequestTarget(student)
                  : undefined
              }
              onEdit={() => setEditStudent(student)}
              onDelete={() => setDeleteStudent(student)}
              onDownloadPdf={() => handleDownloadPdf(student)}
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

      {assignStudent ? (
        <AssignStudentModal
          isOpen={!!assignStudent}
          onClose={() => setAssignStudent(null)}
          studentId={assignStudent.id}
          studentName={assignStudent.full_name}
          onSuccess={() => setAssignStudent(null)}
        />
      ) : null}

      {editStudent ? (
        <EditStudentModal
          isOpen={!!editStudent}
          onClose={() => setEditStudent(null)}
          student={editStudent}
          onSuccess={() => setEditStudent(null)}
        />
      ) : null}

      {deleteStudent ? (
        <ConfirmDeleteModal
          isOpen={!!deleteStudent}
          onClose={() => setDeleteStudent(null)}
          targetName={deleteStudent.full_name}
          resource="student"
          targetId={deleteStudent.id}
          onSuccess={() => setDeleteStudent(null)}
        />
      ) : null}

      {removeRequestTarget ? (
        <RequestRemoveTeacherModal
          isOpen={!!removeRequestTarget}
          onClose={() => setRemoveRequestTarget(null)}
          studentId={removeRequestTarget.id}
          studentName={removeRequestTarget.full_name}
          onSuccess={() => setRemoveRequestTarget(null)}
        />
      ) : null}

      {deleteRequestTarget ? (
        <RequestDeleteStudentModal
          isOpen={!!deleteRequestTarget}
          onClose={() => setDeleteRequestTarget(null)}
          studentId={deleteRequestTarget.id}
          studentName={deleteRequestTarget.full_name}
          onSuccess={() => setDeleteRequestTarget(null)}
        />
      ) : null}

      {showAssignRequestModal ? (
        <RequestAssignStudentModal
          isOpen={showAssignRequestModal}
          onClose={() => setShowAssignRequestModal(false)}
          onSuccess={() => setShowAssignRequestModal(false)}
        />
      ) : null}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-border-card bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-tile-blue">
        <UserX className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mb-1 text-lg font-bold text-text-title">
        {hasFilters ? "لا توجد نتائج مطابقة" : "لا يوجد طلاب بعد"}
      </h3>
      <p className="mb-5 text-sm text-text-muted">
        {hasFilters
          ? "جرّب تعديل كلمة البحث أو إزالة الفلاتر لرؤية المزيد."
          : "سيظهر الطلاب هنا فور تسجيلهم."}
      </p>
      {hasFilters ? (
        <Button
          variant="outline"
          onClick={onClearFilters}
          className="h-11 rounded-[12px] px-5 font-bold"
        >
          مسح الفلاتر
        </Button>
      ) : null}
    </div>
  );
}
