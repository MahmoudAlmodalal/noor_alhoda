"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Users, BookOpen, Edit, Trash2, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { AddRingModal, EditRingModal } from "@/components/modals/RingModals";
import { ConfirmDeleteModal } from "@/components/modals/TeacherModals";
import type { Ring } from "@/types/api";

export default function RingsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const { data: rings, isLoading, refetch } = useApi<Ring[]>("/api/students/rings/");

  useEffect(() => {
    refetch({ search: debouncedSearch });
  }, [debouncedSearch, refetch]);

  // Modal states
  const [showAdd, setShowAdd] = useState(false);
  const [editRing, setEditRing] = useState<Ring | null>(null);
  const [deleteRing, setDeleteRing] = useState<Ring | null>(null);

  if (isLoading && !rings) return <PageLoading />;

  const ringList = rings ?? [];

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-2xl font-bold text-primary">حلقات التحفيظ</h1>
        <p className="text-sm text-slate-500">إدارة الحلقات القرآنية وتوزيع الطلاب</p>
      </div>

      {/* Toolbar */}
      <div className="space-y-4">
        <Input
          icon={<Search className="w-5 h-5" />}
          placeholder="البحث باسم الحلقة أو المحفظ..."
          className="rounded-2xl h-14 bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button 
          onClick={() => setShowAdd(true)}
          className="w-full h-14 rounded-2xl gap-2 font-bold text-base shadow-md shadow-primary/20"
        >
          إضافة حلقة جديدة
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Rings List */}
      <div className="space-y-4">
        {ringList.length === 0 ? (
          <div className="text-center py-12">
            <LayoutGrid className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">لا يوجد حلقات مسجلة</p>
          </div>
        ) : (
          ringList.map((ring) => (
            <Card key={ring.id} className="rounded-3xl border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] overflow-hidden pt-5 relative bg-white">
              <CardContent className="p-5">
                {/* Card Header */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg mb-1">{ring.name}</h3>
                    <Badge 
                      variant={ring.status === "active" ? "success" : "destructive"}
                      className={ring.status === "active" ? "bg-[#eefbee] text-[#2f944d] rounded-md px-3 py-0.5 font-normal" : "bg-red-100 text-red-600 rounded-md px-3 py-0.5 font-normal"}
                    >
                      {ring.status === "active" ? "نشطة" : "متوقفة"}
                    </Badge>
                  </div>
                  <div className="bg-[#eef3f8] w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                </div>

                {/* Card Details */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 w-24 shrink-0 text-slate-400">
                      <Users className="w-4 h-4" />
                      <span className="text-xs font-medium">المحفظ</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800 flex-1">{ring.teacher_name || "غير معين"}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 w-24 shrink-0 text-slate-400">
                      <Users className="w-4 h-4" />
                      <span className="text-xs font-medium">عدد الطلاب</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800 flex-1">{ring.students_count} طالب</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 w-24 shrink-0 text-slate-400">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-xs font-medium">المستوى</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800 flex-1">{ring.level || "مستوى عام"}</span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex gap-3">
                  <Button 
                    variant="ghost" 
                    className="bg-[#fff4ed] text-[#e85b2e] hover:bg-[#ffe6da] hover:text-[#e85b2e] flex-1 font-bold h-12 rounded-2xl gap-2"
                    onClick={() => setEditRing(ring)}
                  >
                    تعديل
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" size="icon" 
                    className="text-[#f43f5e] bg-[#fff1f2] hover:bg-[#ffe4e6] rounded-2xl w-12 h-12 shrink-0"
                    onClick={() => setDeleteRing(ring)}
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
      <AddRingModal 
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => { setShowAdd(false); refetch(); }}
      />

      {editRing && (
        <EditRingModal
          isOpen={!!editRing}
          onClose={() => setEditRing(null)}
          ring={editRing}
          onSuccess={() => { setEditRing(null); refetch(); }}
        />
      )}

      {deleteRing && (
        <ConfirmDeleteModal
          isOpen={!!deleteRing}
          onClose={() => setDeleteRing(null)}
          targetName={deleteRing.name}
          deleteEndpoint={`/api/students/rings/${deleteRing.id}/`}
          onSuccess={() => { setDeleteRing(null); refetch(); }}
        />
      )}
    </div>
  );
}
