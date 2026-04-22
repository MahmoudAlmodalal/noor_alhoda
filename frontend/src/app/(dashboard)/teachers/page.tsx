"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus, Edit, Trash2, UserCog } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useQuery } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import type { TeacherWithUser } from "@/hooks/queries";
import {
  AddTeacherModal,
  EditTeacherModal,
  ConfirmDeleteModal,
} from "@/components/modals/TeacherModals";
import { RoleGate } from "@/components/auth/RoleGate";

function TeachersPageInner() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const { data: teachers, isLoading } = useQuery<TeacherWithUser[]>("teachers");

  const [showAdd, setShowAdd] = useState(false);
  const [editTeacher, setEditTeacher] = useState<TeacherWithUser | null>(null);
  const [deleteTeacher, setDeleteTeacher] = useState<TeacherWithUser | null>(null);

  const teacherList = useMemo(() => {
    const all = teachers ?? [];
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        (t.national_id ?? "").toLowerCase().includes(q)
    );
  }, [teachers, debouncedSearch]);

  if (isLoading && !teachers) return <PageLoading />;

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-2xl font-bold text-primary">إدارة المحفظين</h1>
        <p className="text-sm text-text-muted">إضافة وتعيين الحلقات لمعلمي التحفيظ</p>
      </div>

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

      <div className="space-y-4">
        {teacherList.length === 0 ? (
          <div className="text-center py-12">
            <UserCog className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-muted font-medium">لا يوجد محفظون مسجلون</p>
          </div>
        ) : (
          teacherList.map((teacher) => (
            <Card key={teacher.id} className="rounded-[24px] border-border-card shadow-sm overflow-hidden pt-4 relative">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-[#eef3f8] w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                    <UserCog className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-text-title text-lg">{teacher.full_name}</h3>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center bg-surface-subtle p-2.5 rounded-lg px-4">
                    <span className="text-sm text-text-muted font-medium">رقم الهوية:</span>
                    <span className="text-sm font-semibold text-text-body" dir="ltr">{teacher.national_id || "—"}</span>
                  </div>

                  <div className="flex justify-between items-center bg-surface-subtle p-2.5 rounded-lg px-4">
                    <span className="text-sm text-text-muted font-medium">التخصص:</span>
                    <span className="text-sm font-semibold text-text-body">{teacher.specialization || "—"}</span>
                  </div>

                  <div className="flex justify-between items-center bg-surface-subtle p-2.5 rounded-lg px-4">
                    <span className="text-sm text-text-muted font-medium">التباعية:</span>
                    <span className="text-sm font-semibold text-text-body">
                      {teacher.affiliation === "dar_quran" ? "دار القرآن" :
                       teacher.affiliation === "awqaf" ? "أوقاف" :
                       teacher.affiliation === "sheikh_tabaea" ? "شيخ التباعية" :
                       teacher.affiliation || "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-surface-subtle p-2.5 rounded-lg px-4">
                    <span className="text-sm text-text-muted font-medium">اسم الحلقة:</span>
                    <span className="text-sm font-semibold text-text-body">{teacher.ring_name || "—"}</span>
                  </div>

                  <div className="flex justify-between items-center bg-surface-subtle p-2.5 rounded-lg px-4">
                    <span className="text-sm text-text-muted font-medium">أيام الحلقة:</span>
                    <span className="text-sm font-semibold text-text-body">
                      {teacher.session_days?.length ? teacher.session_days.join(", ") : "غير محدد"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-border-card">
                  <Button
                    variant="ghost" size="icon"
                    className="text-text-muted hover:text-primary hover:bg-surface-subtle"
                    onClick={() => setEditTeacher(teacher)}
                    aria-label={`تعديل المحفظ ${teacher.full_name}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-6 bg-border-card" />
                  <Button
                    variant="ghost" size="icon"
                    className="text-text-muted hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTeacher(teacher)}
                    aria-label={`حذف المحفظ ${teacher.full_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AddTeacherModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => setShowAdd(false)}
      />

      {editTeacher && (
        <EditTeacherModal
          isOpen={!!editTeacher}
          onClose={() => setEditTeacher(null)}
          teacher={editTeacher}
          onSuccess={() => setEditTeacher(null)}
        />
      )}

      {deleteTeacher && (
        <ConfirmDeleteModal
          isOpen={!!deleteTeacher}
          onClose={() => setDeleteTeacher(null)}
          targetName={deleteTeacher.full_name}
          resource="teacher"
          targetId={deleteTeacher.id}
          onSuccess={() => setDeleteTeacher(null)}
        />
      )}
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
