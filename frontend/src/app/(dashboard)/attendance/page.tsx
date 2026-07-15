"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardCheck, Loader2, Save } from "lucide-react";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { SectionCard } from "@/components/ui/SectionCard";
import { Pattern } from "@/components/ui/Pattern";
import { useQuery } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { runMutation } from "@/hooks/mutations";
import { getDb } from "@/lib/db/schema";
import { decryptRow } from "@/lib/db/repos/index";
import type { DailyRecordRecord } from "@/lib/db/repos/records";
import { triggerPush } from "@/lib/sync/push";
import type {
  DailyRecordRecord as DailyRec,
  StudentWithTeacher,
  TeacherWithUser,
} from "@/hooks/queries";
import { AttendanceRow, type DraftRecord } from "./AttendanceRow";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Saturday on or before `d`, as ISO date. */
function weekStartFor(d: Date): string {
  const copy = new Date(d.getTime());
  const diff = (copy.getDay() - 6 + 7) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy.toISOString().slice(0, 10);
}

function weekdayKey(d: Date): "sat" | "sun" | "mon" | "tue" | "wed" | "thu" | "fri" {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[d.getDay()];
}

function weekNumberFor(iso: string): number {
  const d = new Date(iso);
  const firstDay = new Date(Date.UTC(d.getFullYear(), 0, 1));
  const diffDays = Math.floor((d.getTime() - firstDay.getTime()) / 86_400_000);
  return Math.floor(diffDays / 7) + 1;
}

/** Find an existing weekly plan locally or enqueue a new one; returns its id. */
async function ensureWeeklyPlan(
  student_id: string,
  week_start: string
): Promise<string | null> {
  const rows = await getDb()
    .weekly_plans.where("student_id")
    .equals(student_id)
    .toArray();
  for (const r of rows) {
    if (r.week_start === week_start) return r.id;
  }
  const res = await runMutation({
    resource: "weekly_plan",
    action: "create",
    payload: {
      student_id,
      week_start,
      week_number: weekNumberFor(week_start),
      total_required: 0,
    },
  });
  return res.ok ? res.id ?? null : null;
}

async function findDailyRecordId(
  weekly_plan_id: string,
  day: string
): Promise<string | null> {
  const rows = await getDb()
    .daily_records.where("[weekly_plan_id+day]")
    .equals([weekly_plan_id, day])
    .toArray();
  return rows[0]?.id ?? null;
}

function AttendanceContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const initialDate =
    searchParams.get("date") === "today"
      ? todayISO()
      : searchParams.get("date") || todayISO();

  const [date, setDate] = useState<string>(initialDate);
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const [drafts, setDrafts] = useState<Map<string, DraftRecord>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isAdmin = user?.role === "admin";

  const studentParams = useMemo<Record<string, string | undefined>>(() => {
    return teacherFilter ? { teacher_id: teacherFilter } : {};
  }, [teacherFilter]);

  const { data: students } = useQuery<StudentWithTeacher[]>(
    "students_with_teacher",
    studentParams
  );
  const { data: records } = useQuery<DailyRec[]>("daily_records", { date });
  const { data: teachers } = useQuery<TeacherWithUser[]>(isAdmin ? "teachers" : null);

  // Seed drafts whenever students or records change. Records from the
  // encrypted table carry weekly_plan_id, not student_id directly — resolve
  // via the plans table so we can key drafts by student.
  useEffect(() => {
    let cancelled = false;
    const buildDrafts = async () => {
      const map = new Map<string, DraftRecord>();

      // Build a plan_id → student_id map for the records we have.
      const planIds = new Set<string>();
      (records ?? []).forEach((r) => planIds.add(r.weekly_plan_id));
      const planToStudent = new Map<string, string>();
      for (const pid of planIds) {
        const row = await getDb().weekly_plans.get(pid);
        if (row) planToStudent.set(pid, row.student_id);
      }

      const recordsByStudent = new Map<string, DailyRec>();
      (records ?? []).forEach((r) => {
        const sid = planToStudent.get(r.weekly_plan_id);
        if (sid) recordsByStudent.set(sid, r);
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
          review_surah_name: existing?.review_surah_name ?? "",
          review_from_ayah: existing?.review_from_ayah ?? "",
          review_to_ayah: existing?.review_to_ayah ?? "",
          review_quality: existing?.review_quality ?? "none",
          dirty: false,
        });
      });

      if (!cancelled) {
        setDrafts(map);
        setDirty(false);
      }
    };
    void buildDrafts();
    return () => {
      cancelled = true;
    };
  }, [students, records]);

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

    const selectedDay = new Date(date + "T00:00:00").getDay();
    if (selectedDay === 5) {
      showToast("لا يمكن تسجيل الحضور ليوم الجمعة", "error");
      return;
    }

    setIsSaving(true);

    const ws = weekStartFor(new Date(date));
    const day = weekdayKey(new Date(date));

    const dirtyDrafts = Array.from(drafts.values()).filter((d) => d.dirty);
    let failed = 0;

    for (const d of dirtyDrafts) {
      if (!d.attendance) continue;

      const planId = await ensureWeeklyPlan(d.student_id, ws);
      if (!planId) {
        failed++;
        continue;
      }

      const existingId = d.record_id ?? (await findDailyRecordId(planId, day));
      const payload = {
        weekly_plan_id: planId,
        day,
        date,
        attendance: d.attendance,
        surah_name: d.surah_name,
        required_verses: d.required_verses,
        achieved_verses: d.achieved_verses,
        quality: d.quality,
        note: d.note,
        review_surah_name: d.review_surah_name,
        review_from_ayah: d.review_from_ayah === "" ? null : Number(d.review_from_ayah),
        review_to_ayah: d.review_to_ayah === "" ? null : Number(d.review_to_ayah),
        review_quality: d.review_quality,
      };
      const res = existingId
        ? await runMutation({
            resource: "daily_record",
            action: "update",
            payload: { id: existingId, ...payload },
          })
        : await runMutation({
            resource: "daily_record",
            action: "create",
            payload,
          });
      if (!res.ok) failed++;
    }

    setIsSaving(false);
    void triggerPush();

    if (failed > 0) {
      showToast(`تم الحفظ مع ${failed} أخطاء`, "error");
    } else {
      showToast("تم حفظ الحضور بنجاح", "success");
    }
  };

  const studentList = students ?? [];

  const attendanceStats = useMemo(() => {
    const all = Array.from(drafts.values());
    const total = all.length;
    const present = all.filter((d) => d.attendance === "present").length;
    const absent = all.filter((d) => d.attendance === "absent").length;
    const late = all.filter((d) => d.attendance === "late").length;
    const recorded = all.filter((d) => d.attendance).length;
    return { total, present, absent, late, recorded };
  }, [drafts]);

  // Side-effect: silence unused imports warnings in stripped build
  void decryptRow;
  const _dummy: DailyRecordRecord | null = null;
  void _dummy;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div
        className="relative overflow-hidden rounded-[24px] p-6 text-white shadow-lg shadow-primary/20"
        style={{ background: "linear-gradient(135deg, #0b5394, #083d73)" }}
      >
        <Pattern kind="star8" color="#eabd5b" opacity={0.25} size={48} />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-[14px] flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">تسجيل الحضور</h1>
            <p className="text-xs text-white/80">حفظ حضور وغياب الطلاب</p>
          </div>
        </div>
      </div>

      <SectionCard padding="lg" radius="xl">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-text-body">التاريخ</label>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-[14px] border border-border-subtle bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              dir="ltr"
            />
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-body">المحفظ</label>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="h-11 w-full rounded-[14px] border border-border-subtle bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">جميع المحفظين</option>
                {(teachers ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
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
              className="w-full h-11 px-4 bg-primary text-white text-sm font-bold rounded-[14px] hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ الكل
            </button>
          </div>
        </div>
      </SectionCard>

      {attendanceStats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SectionCard padding="sm" radius="md" className="text-center">
            <p className="text-[10px] text-text-muted font-medium mb-1">الحاضرون</p>
            <h3 className="text-2xl font-black text-attend-present-text">{attendanceStats.present}</h3>
          </SectionCard>
          <SectionCard padding="sm" radius="md" className="text-center">
            <p className="text-[10px] text-text-muted font-medium mb-1">الغائبون</p>
            <h3 className="text-2xl font-black text-attend-absent-text">{attendanceStats.absent}</h3>
          </SectionCard>
          <SectionCard padding="sm" radius="md" className="text-center">
            <p className="text-[10px] text-text-muted font-medium mb-1">المتأخرون</p>
            <h3 className="text-2xl font-black text-attend-late-text">{attendanceStats.late}</h3>
          </SectionCard>
          <SectionCard padding="sm" radius="md" className="text-center">
            <p className="text-[10px] text-text-muted font-medium mb-1">تم التسجيل</p>
            <h3 className="text-2xl font-black text-primary">
              {attendanceStats.recorded}
              <span className="text-sm text-text-muted font-bold">/{attendanceStats.total}</span>
            </h3>
          </SectionCard>
        </div>
      )}

      <div className="space-y-3">
        {studentList.length === 0 ? (
          <SectionCard padding="lg" radius="xl" className="py-12 text-center">
            <p className="text-sm text-text-muted font-medium">لا يوجد طلاب</p>
          </SectionCard>
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
