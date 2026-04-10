"use client";

import { useState, useEffect } from "react";
import { Search, UserPlus, CheckCircle2, Edit, Trash2, UserCog } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AddTeacherModal,
  EditTeacherModal,
  ConfirmDeleteModal,
  AssignRingModal,
} from "@/components/modals/TeacherModals";
import type { Teacher } from "@/types/api";

export default function TeachersPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const { data: teachers, isLoading, refetch } = useApi<Teacher[]>("/api/users/teachers/");

  useEffect(() => {
    refetch({ search: debouncedSearch });
  }, [debouncedSearch, refetch]);

  // Modal states
  const [showAdd, setShowAdd] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const [deleteTeacher, setDeleteTeacher] = useState<Teacher | null>(null);
  const [assignRing, setAssignRing] = useState<Teacher | null>(null);

  if (isLoading && !teachers) return <PageLoading />;

  const teacherList = teachers ?? [];

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-2xl font-bold text-primary">إدارة المحفظين</h1>
        <p className="text-sm text-slate-500">إضافة وتعيين الحلقات لمعلمي التحفيظ</p>
      </div>

      {/* Toolbar */}
      <div className="space-y-4">
        <Input
          icon={<Search className="w-5 h-5" />}
          placeholder="البحث بالاسم..."
          className="rounded-2xl h-14"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          onClick={() => setShowAdd(true)}
          className="w-full h-14 rounded-2xl gap-2 font-bold text-base shadow-md shadow-primary/20"
        >
          إضافة محفظ جديد
          <UserPlus className="w-5 h-5" />
        </Button>
      </div>

      {/* Teachers List */}
      <div className="space-y-4">
        {teacherList.length === 0 ? (
          <div className="text-center py-12">
            <UserCog className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">لا يوجد محفظون مسجلون</p>
          </div>
        ) : (
          teacherList.map((teacher) => (
            <Card key={teacher.id} className="rounded-3xl border-slate-100 shadow-sm overflow-hidden pt-4 relative">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-[#eef3f8] w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                    <UserCog className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">{teacher.full_name}</h3>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg px-4">
                    <span className="text-sm text-slate-500 font-medium">التخصص:</span>
                    <span className="text-sm font-semibold text-slate-700">{teacher.specialization || "—"}</span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg px-4">
                    <span className="text-sm text-slate-500 font-medium">أيام الحلقة:</span>
                    <span className="text-sm font-semibold text-slate-700">
                      {teacher.session_days?.length ? teacher.session_days.join(", ") : "غير محدد"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg px-4">
                    <span className="text-sm text-slate-500 font-medium">��قصى عدد طلاب:</span>
                    <span className="text-sm font-semibold text-slate-700">{teacher.max_students} طالب</span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <Button
                    variant="ghost"
                    className="flex-1 text-[#2f944d] hover:bg-[#eefbee] gap-1.5 font-bold h-11 hover:text-[#2f944d]"
                    onClick={() => setAssignRing(teacher)}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    تعيين حلقة
                  </Button>
                  <div className="w-px h-6 bg-slate-100" />
                  <Button
                    variant="ghost" size="icon"
                    className="text-slate-400 hover:text-primary hover:bg-slate-50"
                    onClick={() => setEditTeacher(teacher)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-6 bg-slate-100" />
                  <Button
                    variant="ghost" size="icon"
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTeacher(teacher)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modals */}
      <AddTeacherModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => { setShowAdd(false); refetch(); }}
      />

      {editTeacher && (
        <EditTeacherModal
          isOpen={!!editTeacher}
          onClose={() => setEditTeacher(null)}
          teacher={editTeacher}
          onSuccess={() => { setEditTeacher(null); refetch(); }}
        />
      )}

      {deleteTeacher && (
        <ConfirmDeleteModal
          isOpen={!!deleteTeacher}
          onClose={() => setDeleteTeacher(null)}
          targetName={deleteTeacher.full_name}
          deleteEndpoint={`/api/users/${deleteTeacher.id}/`}
          onSuccess={() => { setDeleteTeacher(null); refetch(); }}
        />
      )}

      {assignRing && (
        <AssignRingModal
          isOpen={!!assignRing}
          onClose={() => setAssignRing(null)}
          teacherId={assignRing.id}
          teacherName={assignRing.full_name}
          onSuccess={() => { setAssignRing(null); refetch(); }}
        />
      )}
    </div>
  );
}
