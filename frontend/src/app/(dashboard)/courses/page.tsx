"use client";

import { useState } from "react";
import { BookMarked, Edit, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useApi } from "@/hooks/useApi";
import { AddCourseModal, EditCourseModal } from "@/components/modals/CourseModals";
import { ConfirmDeleteModal } from "@/components/modals/TeacherModals";
import { RoleGate } from "@/components/auth/RoleGate";
import type { Course } from "@/types/api";

function CoursesPageInner() {
  const { data: courses, isLoading, refetch } = useApi<Course[]>("/api/courses/");

  const [showAdd, setShowAdd] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteCourse, setDeleteCourse] = useState<Course | null>(null);

  if (isLoading && !courses) return <PageLoading />;

  const list = courses ?? [];

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-2xl font-bold text-primary">إدارة الدورات</h1>
        <p className="text-sm text-slate-500">إنشاء وتعديل الدورات التدريبية</p>
      </div>

      {/* Toolbar */}
      <Button
        onClick={() => setShowAdd(true)}
        className="w-full h-14 rounded-2xl gap-2 font-bold text-base shadow-md shadow-primary/20"
      >
        إضافة دورة جديدة
        <Plus className="w-5 h-5" />
      </Button>

      {/* Courses List */}
      <div className="space-y-4">
        {list.length === 0 ? (
          <div className="text-center py-12">
            <BookMarked className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">لا توجد دورات مسجلة</p>
          </div>
        ) : (
          list.map((course) => (
            <Card
              key={course.id}
              className="rounded-3xl border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] overflow-hidden pt-5 relative bg-white"
            >
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-5">
                  <div className="flex-1 min-w-0 pe-3">
                    <h3 className="font-bold text-slate-900 text-lg mb-1">
                      {course.name}
                    </h3>
                    {course.description && (
                      <p className="text-sm text-slate-500 line-clamp-3 whitespace-pre-wrap">
                        {course.description}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-2" dir="ltr">
                      {new Date(course.created_at).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <div className="bg-[#eef3f8] w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                    <BookMarked className="w-6 h-6 text-primary" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    className="bg-[#fff4ed] text-[#e85b2e] hover:bg-[#ffe6da] hover:text-[#e85b2e] flex-1 font-bold h-12 rounded-2xl gap-2"
                    onClick={() => setEditCourse(course)}
                    aria-label={`تعديل الدورة ${course.name}`}
                  >
                    تعديل
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#f43f5e] bg-[#fff1f2] hover:bg-[#ffe4e6] rounded-2xl w-12 h-12 shrink-0"
                    onClick={() => setDeleteCourse(course)}
                    aria-label={`حذف الدورة ${course.name}`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modals */}
      <AddCourseModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => {
          setShowAdd(false);
          refetch();
        }}
      />

      {editCourse && (
        <EditCourseModal
          isOpen={!!editCourse}
          onClose={() => setEditCourse(null)}
          course={editCourse}
          onSuccess={() => {
            setEditCourse(null);
            refetch();
          }}
        />
      )}

      {deleteCourse && (
        <ConfirmDeleteModal
          isOpen={!!deleteCourse}
          onClose={() => setDeleteCourse(null)}
          targetName={deleteCourse.name}
          deleteEndpoint={`/api/courses/${deleteCourse.id}/`}
          onSuccess={() => {
            setDeleteCourse(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

export default function CoursesPage() {
  return (
    <RoleGate roles={["admin"]}>
      <CoursesPageInner />
    </RoleGate>
  );
}
