"use client";

import { useState, useEffect } from "react";
import { Search, UserCog, Edit, Trash2, FileText, User } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { AssignStudentModal, EditStudentModal } from "@/components/modals/StudentModals";
import { ConfirmDeleteModal } from "@/components/modals/TeacherModals";
import type { Student } from "@/types/api";

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const { data: students, isLoading, refetch } = useApi<Student[]>("/api/students/");

  useEffect(() => {
    refetch({ search: debouncedSearch });
  }, [debouncedSearch, refetch]);

  // Modal state
  const [assignModal, setAssignModal] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null });
  const [editModal, setEditModal] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null });

  if (isLoading && !students) return <PageLoading />;

  const studentList = students ?? [];

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-2xl font-bold text-primary">سجل ال��لاب</h1>
        <p className="text-sm text-slate-500">إدارة ومتابعة جميع ��لطلاب المسجلين بالمركز</p>
      </div>

      {/* Toolbar */}
      <div className="space-y-4">
        <Input
          icon={<Search className="w-5 h-5" />}
          placeholder="البحث بالاسم أو الهوية..."
          className="rounded-2xl h-14 bg-slate-50/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Students List */}
      <div className="space-y-4">
        {studentList.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">لا يوجد طلاب مسجلون</p>
          </div>
        ) : (
          studentList.map((student) => (
            <Card key={student.id} className="rounded-3xl border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden pt-4 relative bg-white">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-[#eef3f8] w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">{student.full_name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{student.national_id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-3 mb-6">
                  <div className="bg-slate-50/80 p-3 rounded-xl">
                    <span className="block text-[11px] text-slate-500 font-medium mb-1">الصف الدراسي:</span>
                    <span className="block text-sm font-bold text-slate-800">{student.grade}</span>
                  </div>

                  <div className="bg-slate-50/80 p-3 rounded-xl">
                    <span className="block text-[11px] text-slate-500 font-medium mb-1">المحفظ:</span>
                    <Badge
                      variant={student.teacher_name ? "secondary" : "destructive"}
                      className={student.teacher_name ? "bg-[#eef3f8] text-primary hover:bg-[#eef3f8] font-normal px-2.5 py-0.5 rounded-md" : "font-normal bg-red-50 text-red-600 px-2.5 py-0.5 rounded-md"}
                    >
                      {student.teacher_name || "غير معين"}
                    </Badge>
                  </div>

                  <div className="bg-slate-50/80 p-3 rounded-xl">
                    <span className="block text-[11px] text-slate-500 font-medium mb-1">ولي الأمر:</span>
                    <span className="block text-sm font-bold text-slate-800 line-clamp-1">{student.guardian_name || "—"}</span>
                  </div>

                  <div className="bg-slate-50/80 p-3 rounded-xl">
                    <span className="block text-[11px] text-slate-500 font-medium mb-1">الحالة:</span>
                    <Badge
                      variant={student.is_active ? "success" : "destructive"}
                      className={student.is_active ? "font-normal bg-[#eefbee] text-[#2f944d] rounded-md px-3 py-0.5" : "bg-red-100 text-red-600 rounded-md px-3 py-0.5 font-normal"}
                    >
                      {student.is_active ? "نشط" : "منقطع"}
                    </Badge>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 px-2">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="icon"
                      className="text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg w-10 h-10"
                      onClick={() => setAssignModal({ open: true, student })}
                    >
                      <UserCog className="w-[18px] h-[18px]" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg w-10 h-10"
                      onClick={async () => {
                        const blob = await api.downloadBlob(`/api/reports/student/${student.id}/pdf/`);
                        if (!blob) {
                          console.error('فشل تحميل التقرير');
                          return;
                        }
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `تقرير_${student.full_name}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                      }}
                      disabled={!student.id}
                    >
                      <FileText className="w-[18px] h-[18px]" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="icon"
                      className="text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg w-10 h-10"
                      onClick={() => setEditModal({ open: true, student })}
                    >
                      <Edit className="w-[18px] h-[18px]" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg w-10 h-10"
                      onClick={() => setDeleteModal({ open: true, student })}
                    >
                      <Trash2 className="w-[18px] h-[18px]" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modals */}
      {assignModal.student && (
        <AssignStudentModal
          isOpen={assignModal.open}
          onClose={() => setAssignModal({ open: false, student: null })}
          studentId={assignModal.student.id}
          studentName={assignModal.student.full_name}
          onSuccess={() => { setAssignModal({ open: false, student: null }); refetch(); }}
        />
      )}

      {editModal.student && (
        <EditStudentModal
          isOpen={editModal.open}
          onClose={() => setEditModal({ open: false, student: null })}
          student={editModal.student}
          onSuccess={() => { setEditModal({ open: false, student: null }); refetch(); }}
        />
      )}

      {deleteModal.student && (
        <ConfirmDeleteModal
          isOpen={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, student: null })}
          targetName={deleteModal.student.full_name}
          deleteEndpoint={`/api/students/${deleteModal.student.id}/`}
          onSuccess={() => { setDeleteModal({ open: false, student: null }); refetch(); }}
        />
      )}
    </div>
  );
}
