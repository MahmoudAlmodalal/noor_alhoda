"use client";

import { useMemo, useState } from "react";
import { Edit, FileText, Search, Trash2, User, UserCog } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import type { CourseRecord, StudentWithTeacher, TeacherWithUser } from "@/hooks/queries";
import { api } from "@/lib/api";
import {
  AssignStudentModal,
  EditStudentModal,
} from "@/components/modals/StudentModals";
import { ConfirmDeleteModal } from "@/components/modals/TeacherModals";

const PAGE_SIZE = 20;

function PaginationBar({
  page,
  totalPages,
  count,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  count: number;
  onPageChange: (nextPage: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-border-card bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-muted">
        إجمالي الطلاب: <span className="font-bold text-text-title">{count}</span>
      </p>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-[10px] border border-border-subtle px-3 py-2 text-sm font-semibold text-text-body disabled:cursor-not-allowed disabled:opacity-50"
        >
          السابق
        </button>
        <span className="text-sm font-semibold text-text-body">
          صفحة {page} من {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-[10px] border border-border-subtle px-3 py-2 text-sm font-semibold text-text-body disabled:cursor-not-allowed disabled:opacity-50"
        >
          التالي
        </button>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canFilterByCourse = user?.role === "admin" || user?.role === "teacher";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");

  const debouncedSearch = useDebounce(search);

  const { data: teachers } = useQuery<TeacherWithUser[]>(isAdmin ? "teachers" : null);
  const { data: courses } = useQuery<CourseRecord[]>(canFilterByCourse ? "courses" : null);

  const queryParams = useMemo(() => {
    const p: Record<string, string | undefined> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (isAdmin && teacherFilter) p.teacher_id = teacherFilter;
    if (canFilterByCourse && courseFilter) p.course_id = courseFilter;
    return p;
  }, [debouncedSearch, isAdmin, teacherFilter, canFilterByCourse, courseFilter]);

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
  const studentList = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const [assignModal, setAssignModal] = useState<{ open: boolean; student: StudentWithTeacher | null }>({
    open: false,
    student: null,
  });
  const [editModal, setEditModal] = useState<{ open: boolean; student: StudentWithTeacher | null }>({
    open: false,
    student: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; student: StudentWithTeacher | null }>({
    open: false,
    student: null,
  });

  if (isLoading && !allStudents) {
    return <PageLoading />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-2xl font-bold text-primary">سجل الطلاب</h1>
        <p className="text-sm text-text-muted">إدارة ومتابعة جميع الطلاب المسجلين بالمركز</p>
      </div>

      <div className="space-y-3 rounded-[24px] border border-border-card bg-white p-4 shadow-sm">
        <Input
          icon={<Search className="h-5 w-5" />}
          placeholder="البحث بالاسم أو الهوية..."
          className="h-14 rounded-[16px] bg-surface-subtle"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />

        {isAdmin ? (
          <select
            value={teacherFilter}
            onChange={(event) => {
              setTeacherFilter(event.target.value);
              setPage(1);
            }}
            className="h-12 w-full rounded-[16px] border border-border-subtle bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">كل المحفظين</option>
            {(teachers ?? []).map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.full_name}
              </option>
            ))}
          </select>
        ) : null}

        {canFilterByCourse ? (
          <select
            value={courseFilter}
            onChange={(event) => {
              setCourseFilter(event.target.value);
              setPage(1);
            }}
            className="h-12 w-full rounded-[16px] border border-border-subtle bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">كل الدورات</option>
            {(courses ?? []).map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <PaginationBar
        page={safePage}
        totalPages={totalPages}
        count={sorted.length}
        onPageChange={setPage}
      />

      <div className="space-y-4">
        {studentList.length === 0 ? (
          <div className="py-12 text-center">
            <User className="mx-auto mb-3 h-12 w-12 text-text-muted" />
            <p className="text-sm font-medium text-text-muted">لا يوجد طلاب مطابقون للفلاتر الحالية</p>
          </div>
        ) : (
          studentList.map((student) => (
            <Card
              key={student.id}
              className="relative overflow-hidden rounded-[24px] border-border-card bg-white pt-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
            >
              <CardContent className="p-5">
                <div className="mb-6 flex items-center gap-3">
                  <Avatar name={student.full_name} size={48} />
                  <div>
                    <h3 className="text-lg font-bold leading-tight text-text-title">{student.full_name}</h3>
                    <p className="mt-0.5 text-xs text-text-muted">{student.national_id}</p>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-x-2 gap-y-3">
                  <div className="rounded-[12px] bg-surface-subtle p-3">
                    <span className="mb-1 block text-[11px] font-medium text-text-muted">الصف الدراسي:</span>
                    <span className="block text-sm font-bold text-text-body">{student.grade}</span>
                  </div>

                  <div className="rounded-[12px] bg-surface-subtle p-3">
                    <span className="mb-1 block text-[11px] font-medium text-text-muted">المحفظ:</span>
                    <Badge
                      variant={student.teacher_name ? "secondary" : "destructive"}
                      className={
                        student.teacher_name
                          ? "rounded-md bg-role-admin-bg px-2.5 py-0.5 font-normal text-primary hover:bg-role-admin-bg"
                          : "rounded-md bg-tile-red px-2.5 py-0.5 font-normal text-danger-text"
                      }
                    >
                      {student.teacher_name || "غير معين"}
                    </Badge>
                  </div>

                  <div className="rounded-[12px] bg-surface-subtle p-3">
                    <span className="mb-1 block text-[11px] font-medium text-text-muted">ولي الأمر:</span>
                    <span className="line-clamp-1 block text-sm font-bold text-text-body">
                      {student.guardian_name || "—"}
                    </span>
                  </div>

                  <div className="rounded-[12px] bg-surface-subtle p-3">
                    <span className="mb-1 block text-[11px] font-medium text-text-muted">رقم الجوال:</span>
                    <span className="block text-sm font-bold text-text-body">{student.mobile || "—"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border-card px-2 pt-4">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-[10px] text-text-muted hover:bg-surface-subtle hover:text-primary"
                      onClick={() => setAssignModal({ open: true, student })}
                      aria-label={`تعيين محفظ للطالب ${student.full_name}`}
                    >
                      <UserCog className="h-[18px] w-[18px]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-[10px] text-text-muted hover:bg-surface-subtle hover:text-primary"
                      onClick={async () => {
                        const blob = await api.downloadBlob(`/api/reports/student/${student.id}/pdf/`);
                        if (!blob) return;
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `تقرير_${student.full_name}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                      }}
                      disabled={!student.id}
                      aria-label={`تحميل تقرير الطالب ${student.full_name}`}
                    >
                      <FileText className="h-[18px] w-[18px]" />
                    </Button>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-[10px] text-text-muted hover:bg-surface-subtle hover:text-primary"
                      onClick={() => setEditModal({ open: true, student })}
                      aria-label={`تعديل الطالب ${student.full_name}`}
                    >
                      <Edit className="h-[18px] w-[18px]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-[10px] text-text-muted hover:bg-tile-red hover:text-danger-text"
                      onClick={() => setDeleteModal({ open: true, student })}
                      aria-label={`حذف الطالب ${student.full_name}`}
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <PaginationBar
        page={safePage}
        totalPages={totalPages}
        count={sorted.length}
        onPageChange={setPage}
      />

      {assignModal.student ? (
        <AssignStudentModal
          isOpen={assignModal.open}
          onClose={() => setAssignModal({ open: false, student: null })}
          studentId={assignModal.student.id}
          studentName={assignModal.student.full_name}
          onSuccess={() => setAssignModal({ open: false, student: null })}
        />
      ) : null}

      {editModal.student ? (
        <EditStudentModal
          isOpen={editModal.open}
          onClose={() => setEditModal({ open: false, student: null })}
          student={editModal.student}
          onSuccess={() => setEditModal({ open: false, student: null })}
        />
      ) : null}

      {deleteModal.student ? (
        <ConfirmDeleteModal
          isOpen={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, student: null })}
          targetName={deleteModal.student.full_name}
          resource="student"
          targetId={deleteModal.student.id}
          onSuccess={() => setDeleteModal({ open: false, student: null })}
        />
      ) : null}
    </div>
  );
}
