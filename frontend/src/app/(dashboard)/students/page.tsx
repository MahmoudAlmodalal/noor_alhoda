"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit, FileText, Search, Trash2, User, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { api } from "@/lib/api";
import { AssignStudentModal, EditStudentModal } from "@/components/modals/StudentModals";
import { ConfirmDeleteModal } from "@/components/modals/TeacherModals";
import type { Course, PaginatedData, Student, Teacher } from "@/types/api";

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
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        إجمالي الطلاب: <span className="font-bold text-slate-900">{count}</span>
      </p>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          السابق
        </button>
        <span className="text-sm font-semibold text-slate-700">
          صفحة {page} من {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          التالي
        </button>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === "admin";
  const canFilterByCourse = user?.role === "admin" || user?.role === "teacher";

  const [studentsPage, setStudentsPage] = useState<PaginatedData<Student> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");

  const debouncedSearch = useDebounce(search);
  const { data: teachers } = useApi<Teacher[]>(isAdmin ? "/api/users/teachers/" : null);
  const { data: courses } = useApi<Course[]>(canFilterByCourse ? "/api/courses/" : null);

  useEffect(() => {
    setPage(1);
  }, [courseFilter, debouncedSearch, teacherFilter]);

  const reload = useCallback(
    async (pageToLoad = page) => {
      setLoading(true);
      const response = await api.get<PaginatedData<Student>>("/api/students/", {
        paginated: "1",
        page: String(pageToLoad),
        search: debouncedSearch || undefined,
        teacher_id: isAdmin ? teacherFilter || undefined : undefined,
        course_id: canFilterByCourse ? courseFilter || undefined : undefined,
      });

      if (response.success) {
        setStudentsPage(response.data);
        if (response.data.page !== pageToLoad) {
          setPage(response.data.page);
        }
      } else {
        showToast(response.error?.message || "تعذر تحميل قائمة الطلاب.", "error");
      }

      setLoading(false);
    },
    [canFilterByCourse, courseFilter, debouncedSearch, isAdmin, page, showToast, teacherFilter],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const [assignModal, setAssignModal] = useState<{ open: boolean; student: Student | null }>({
    open: false,
    student: null,
  });
  const [editModal, setEditModal] = useState<{ open: boolean; student: Student | null }>({
    open: false,
    student: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; student: Student | null }>({
    open: false,
    student: null,
  });

  if (loading && !studentsPage) {
    return <PageLoading />;
  }

  const studentList = studentsPage?.items ?? [];
  const totalPages = studentsPage?.total_pages ?? 1;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-2xl font-bold text-primary">سجل الطلاب</h1>
        <p className="text-sm text-slate-500">إدارة ومتابعة جميع الطلاب المسجلين بالمركز</p>
      </div>

      <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <Input
          icon={<Search className="h-5 w-5" />}
          placeholder="البحث بالاسم أو الهوية..."
          className="h-14 rounded-2xl bg-slate-50/50"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {isAdmin ? (
          <select
            value={teacherFilter}
            onChange={(event) => setTeacherFilter(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            onChange={(event) => setCourseFilter(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
        page={studentsPage?.page ?? 1}
        totalPages={totalPages}
        count={studentsPage?.count ?? 0}
        onPageChange={setPage}
      />

      <div className="space-y-4">
        {loading && !studentsPage ? (
          <PageLoading />
        ) : studentList.length === 0 ? (
          <div className="py-12 text-center">
            <User className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm font-medium text-slate-400">لا يوجد طلاب مطابقون للفلاتر الحالية</p>
          </div>
        ) : (
          studentList.map((student) => (
            <Card
              key={student.id}
              className="relative overflow-hidden rounded-3xl border-slate-100 bg-white pt-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
            >
              <CardContent className="p-5">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef3f8]">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold leading-tight text-slate-900">{student.full_name}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">{student.national_id}</p>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-x-2 gap-y-3">
                  <div className="rounded-xl bg-slate-50/80 p-3">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">الصف الدراسي:</span>
                    <span className="block text-sm font-bold text-slate-800">{student.grade}</span>
                  </div>

                  <div className="rounded-xl bg-slate-50/80 p-3">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">المحفظ:</span>
                    <Badge
                      variant={student.teacher_name ? "secondary" : "destructive"}
                      className={
                        student.teacher_name
                          ? "rounded-md bg-[#eef3f8] px-2.5 py-0.5 font-normal text-primary hover:bg-[#eef3f8]"
                          : "rounded-md bg-red-50 px-2.5 py-0.5 font-normal text-red-600"
                      }
                    >
                      {student.teacher_name || "غير معين"}
                    </Badge>
                  </div>

                  <div className="rounded-xl bg-slate-50/80 p-3">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">ولي الأمر:</span>
                    <span className="line-clamp-1 block text-sm font-bold text-slate-800">
                      {student.guardian_name || "—"}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50/80 p-3">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">رقم الجوال:</span>
                    <span className="block text-sm font-bold text-slate-800">{student.mobile || "—"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 px-2 pt-4">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary"
                      onClick={() => setAssignModal({ open: true, student })}
                      aria-label={`تعيين محفظ للطالب ${student.full_name}`}
                    >
                      <UserCog className="h-[18px] w-[18px]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary"
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
                      className="h-10 w-10 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-primary"
                      onClick={() => setEditModal({ open: true, student })}
                      aria-label={`تعديل الطالب ${student.full_name}`}
                    >
                      <Edit className="h-[18px] w-[18px]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
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
        page={studentsPage?.page ?? 1}
        totalPages={totalPages}
        count={studentsPage?.count ?? 0}
        onPageChange={setPage}
      />

      {assignModal.student ? (
        <AssignStudentModal
          isOpen={assignModal.open}
          onClose={() => setAssignModal({ open: false, student: null })}
          studentId={assignModal.student.id}
          studentName={assignModal.student.full_name}
          onSuccess={() => {
            setAssignModal({ open: false, student: null });
            void reload();
          }}
        />
      ) : null}

      {editModal.student ? (
        <EditStudentModal
          isOpen={editModal.open}
          onClose={() => setEditModal({ open: false, student: null })}
          student={editModal.student}
          onSuccess={() => {
            setEditModal({ open: false, student: null });
            void reload();
          }}
        />
      ) : null}

      {deleteModal.student ? (
        <ConfirmDeleteModal
          isOpen={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, student: null })}
          targetName={deleteModal.student.full_name}
          deleteEndpoint={`/api/students/${deleteModal.student.id}/`}
          onSuccess={() => {
            setDeleteModal({ open: false, student: null });
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}
