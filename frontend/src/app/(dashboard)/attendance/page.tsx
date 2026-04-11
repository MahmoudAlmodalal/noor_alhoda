"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardCheck, Loader2, Save } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import type {
  AttendanceStatus,
  BulkAttendanceRequest,
  CreateRecordRequest,
  DailyRecord,
  Student,
  Teacher,
  UpdateRecordRequest,
} from "@/types/api";
import { AttendanceRow, type DraftRecord } from "./AttendanceRow";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function AttendanceContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date") === "today" ? todayISO() : searchParams.get("date") || todayISO();

  const [date, setDate] = useState<string>(initialDate);
  const [teacherFilter, setTeacherFilter] = useState<string>(
    user?.role === "teacher" && user.id ? user.id : ""
  );
  const [drafts, setDrafts] = useState<Map<string, DraftRecord>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isAdmin = user?.role === "admin";

  const studentParams = useMemo(() => {
    const p: Record<string, string | undefined> = {};
    if (teacherFilter) p.teacher_id = teacherFilter;
    return p;
  }, [teacherFilter]);

  const { data: students, refetch: refetchStudents } = useApi<Student[]>("/api/students/");
  const { data: records, refetch: refetchRecords } = useApi<DailyRecord[]>(
    "/api/records/",
    { date }
  );
  const { data: teachers } = useApi<Teacher[]>(isAdmin ? "/api/users/teachers/" : null);

  // Refetch when date or teacher filter changes
  useEffect(() => {
    refetchStudents(studentParams);
  }, [studentParams, refetchStudents]);

  useEffect(() => {
    refetchRecords({ date });
  }, [date, refetchRecords]);

  // Seed drafts whenever students or records change
  useEffect(() => {
    const map = new Map<string, DraftRecord>();
    const recordsByStudent = new Map<string, DailyRecord>();
    (records ?? []).forEach((r) => {
      if (r.student_id) recordsByStudent.set(r.student_id, r);
    });
    (students ?? []).forEach((s) => {
      const existing = recordsByStudent.get(s.id);
      map.set(s.id, {
        student_id: s.id,
        student_name: s.full_name,
        record_id: existing?.id,
        attendance: existing?.attendance,
        surah_name: existing?.surah_name ?? "",
        required_verses: existing?.required_verses ?? 0,
        achieved_verses: existing?.achieved_verses ?? 0,
        quality: existing?.quality ?? "none",
        note: existing?.note ?? "",
        dirty: false,
      });
    });
    setDrafts(map);
    setDirty(false);
  }, [students, records]);

  // Warn on unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const updateDraft = (studentId: string, patch: Partial<DraftRecord>) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      const cur = next.get(studentId);
      if (cur) next.set(studentId, { ...cur, ...patch, dirty: true });
      return next;
    });
    setDirty(true);
  };

  const saveAll = async () => {
    if (!dirty) {
      showToast("لا توجد تغييرات", "info");
      return;
    }
    setIsSaving(true);

    const draftList = Array.from(drafts.values()).filter((d) => d.dirty);
    const withStatus = draftList.filter((d) => d.attendance);

    // 1) Bulk attendance for everyone with a status
    if (withStatus.length > 0) {
      const payload: BulkAttendanceRequest = {
        date,
        entries: withStatus.map((d) => ({
          student_id: d.student_id,
          status: d.attendance!,
        })),
      };
      const res = await api.post("/api/records/bulk-attendance/", payload);
      if (!res.success) {
        showToast(res.error.message, "error");
        setIsSaving(false);
        return;
      }
    }

    // 2) Per-row PATCH/POST for memorization details
    let failed = 0;
    for (const d of draftList) {
      const hasMemo =
        d.surah_name || d.required_verses > 0 || d.achieved_verses > 0 || d.note;
      if (!hasMemo) continue;

      if (d.record_id) {
        const update: UpdateRecordRequest = {
          attendance: d.attendance,
          surah_name: d.surah_name,
          required_verses: d.required_verses,
          achieved_verses: d.achieved_verses,
          quality: d.quality,
          note: d.note,
        };
        const res = await api.patch(`/api/records/${d.record_id}/`, update);
        if (!res.success) failed++;
      } else if (d.attendance) {
        const create: CreateRecordRequest = {
          student_id: d.student_id,
          date,
          attendance: d.attendance,
          surah_name: d.surah_name || undefined,
          required_verses: d.required_verses || undefined,
          achieved_verses: d.achieved_verses || undefined,
          quality: d.quality || undefined,
          note: d.note || undefined,
        };
        const res = await api.post("/api/records/create/", create);
        if (!res.success) failed++;
      }
    }

    setIsSaving(false);
    if (failed > 0) {
      showToast(`تم الحفظ مع ${failed} أخطاء`, "error");
    } else {
      showToast("تم حفظ الحضور بنجاح", "success");
    }
    refetchRecords({ date });
  };

  const studentList = students ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">تسجيل الحضور</h1>
            <p className="text-xs text-slate-500">حفظ حضور وغياب الطلاب</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">التاريخ</label>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              dir="ltr"
            />
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">المحفظ</label>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">جميع المحفظين</option>
                {(teachers ?? []).map((t) => (
                  <option key={t.id} value={t.user_id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button
              type="button"
              onClick={saveAll}
              disabled={isSaving || !dirty}
              className="w-full h-11 px-4 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ الكل
            </button>
          </div>
        </div>
      </div>

      {/* Students */}
      <div className="space-y-3">
        {studentList.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <p className="text-sm text-slate-400 font-medium">لا يوجد طلاب</p>
          </div>
        ) : (
          studentList.map((student) => {
            const draft = drafts.get(student.id);
            if (!draft) return null;
            return (
              <AttendanceRow
                key={student.id}
                draft={draft}
                onChange={(patch) => updateDraft(student.id, patch)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AttendanceContent />
    </Suspense>
  );
}
