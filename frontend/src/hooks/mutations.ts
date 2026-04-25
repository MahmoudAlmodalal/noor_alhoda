/**
 * Mutation dispatcher: local optimistic write + outbox enqueue per
 * (resource, action). The mutation hook (useMutation) is a thin wrapper
 * around this module — it adds toast + submitting state but doesn't
 * itself know which tables to touch.
 *
 * Contract:
 *   - CREATE: caller passes the full server-shaped payload. An id is
 *     minted if absent. A minimal local record is written immediately so
 *     pages re-render; the next successful push overwrites it with the
 *     server's authoritative row.
 *   - UPDATE: caller passes { id, ...patch }. The existing local record
 *     is read, the patch merged, and the merged record re-encrypted.
 *     `base_updated_at` is read from the cleartext column on the row —
 *     no decrypt needed for LWW metadata.
 *   - DELETE: caller passes { id }. The local row is removed and a
 *     delete op enqueued. The server will return a tombstone on the next
 *     pull that confirms the deletion across devices.
 */

import { emitChange, type ResourceName } from "@/lib/db/events";
import { getDb } from "@/lib/db/schema";
import { enqueueOp, type OutboxAction } from "@/lib/sync/outbox";
import {
  upsertCourses,
  upsertEvaluations,
  upsertNotifications,
  upsertParentStudentLinks,
  upsertStudentCourses,
  upsertTeachers,
  upsertUsers,
  type CourseRecord,
  type EvaluationRecord,
  type NotificationRecord,
  type ParentStudentLinkRecord,
  type StudentCourseRecord,
  type TeacherRecord,
  type UserRecord,
} from "@/lib/db/repos/misc";
import { decryptRow } from "@/lib/db/repos/index";
import {
  upsertDailyRecords,
  upsertReviewRecords,
  upsertWeeklyPlans,
  type DailyRecordRecord,
  type ReviewRecordRecord,
  type WeeklyPlanRecord,
} from "@/lib/db/repos/records";
import {
  deleteStudentLocal,
  getStudent,
  upsertStudent,
  type StudentRecord,
} from "@/lib/db/repos/students";

export type MutationResource =
  | "student"
  | "teacher"
  | "course"
  | "weekly_plan"
  | "daily_record"
  | "review_record"
  | "evaluation"
  | "notification"
  | "student_course"
  | "parent_student_link";

export type MutationAction = OutboxAction;

type Payload = Record<string, unknown>;

// Methods guarding create/update/delete are optional: if a resource has no
// matching BE push dispatcher (see backend/sync/services/push_services.py
// `_DISPATCH`), the corresponding method is omitted and `runMutation` returns
// an "unsupported" error before touching the outbox. Keeps FE/BE in lockstep.
interface Handler {
  resource: ResourceName;
  upsertCreate?(id: string, payload: Payload, nowIso: string): Promise<void>;
  readExisting?(id: string): Promise<Payload | undefined>;
  upsertUpdate?(id: string, merged: Payload, nowIso: string): Promise<void>;
  deleteLocal?(id: string): Promise<void>;
  readBaseUpdatedAt(id: string): Promise<string | null>;
  serverPayload(id: string, localPatchOrFull: Payload): Payload;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function readCleartextUpdatedAt(
  table:
    | "students"
    | "teachers"
    | "courses"
    | "weekly_plans"
    | "daily_records"
    | "review_records"
    | "evaluations"
    | "notifications"
    | "student_courses"
    | "parent_student_links",
  id: string
): Promise<string | null> {
  const row = await getDb()[table].get(id);
  return (row as { updated_at?: string } | undefined)?.updated_at ?? null;
}

// ---------------------------------------------------------------------------
// Per-resource handlers
// ---------------------------------------------------------------------------

const handlers: Record<MutationResource, Handler> = {
  student: {
    resource: "student",
    async upsertCreate(id, payload, now) {
      const rec: StudentRecord = {
        id,
        user_id: "",
        full_name: String(payload.full_name ?? ""),
        national_id: String(payload.national_id ?? ""),
        birthdate: (payload.birthdate as string) ?? null,
        grade: String(payload.grade ?? ""),
        address: String(payload.address ?? ""),
        whatsapp: String(payload.whatsapp ?? ""),
        mobile: String(payload.mobile ?? ""),
        previous_courses: String(payload.previous_courses ?? ""),
        desired_courses: String(payload.desired_courses ?? ""),
        guardian_name: String(payload.guardian_name ?? ""),
        guardian_national_id: String(payload.guardian_national_id ?? ""),
        guardian_mobile: String(payload.guardian_mobile ?? ""),
        teacher_id: (payload.teacher_id as string) ?? null,
        health_status: String(payload.health_status ?? "normal"),
        health_note: String(payload.health_note ?? ""),
        skills: (payload.skills as Record<string, boolean | string>) ?? {},
        review_interval_days: Number(payload.review_interval_days ?? 14),
        enrollment_date: now.slice(0, 10),
        created_at: now,
        updated_at: now,
      };
      await upsertStudent(rec);
    },
    async readExisting(id) {
      const r = await getStudent(id);
      return r as unknown as Payload | undefined;
    },
    async upsertUpdate(id, merged, now) {
      const rec = { ...(merged as unknown as StudentRecord), id, updated_at: now };
      await upsertStudent(rec);
    },
    async deleteLocal(id) {
      await deleteStudentLocal(id);
    },
    readBaseUpdatedAt: (id) => readCleartextUpdatedAt("students", id),
    serverPayload: (_id, payload) => payload,
  },

  teacher: {
    resource: "teacher",
    async upsertCreate(id, payload, now) {
      const rec: TeacherRecord = {
        id,
        user_id: "",
        full_name: String(payload.full_name ?? ""),
        specialization: String(payload.specialization ?? ""),
        session_days: (payload.session_days as string[]) ?? [],
        max_students: Number(payload.max_students ?? 25),
        affiliation: String(payload.affiliation ?? ""),
        ring_name: String(payload.ring_name ?? ""),
        course_ids: (payload.course_ids as string[]) ?? [],
        created_at: now,
        updated_at: now,
      };
      await upsertTeachers([rec]);
    },
    async readExisting(id) {
      const row = await getDb().teachers.get(id);
      if (!row) return undefined;
      return (await decryptRow<TeacherRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now) {
      const patch = merged as Payload;
      const rec: TeacherRecord = {
        ...(merged as unknown as TeacherRecord),
        id,
        updated_at: now,
        course_ids: Array.isArray(patch.course_ids)
          ? (patch.course_ids as string[])
          : ((merged as unknown as TeacherRecord).course_ids ?? []),
      };
      await upsertTeachers([rec]);

      // national_id / phone_number / first_name / last_name live on the
      // related User row. TeacherWithUser reads them via listUsers()
      // (see queries.ts::listTeachersWithUser), so mirror any user-level
      // patch into the local users table for immediate UI feedback. The
      // next pull reconciles against the server.
      const userFieldKeys = ["national_id", "phone_number", "first_name", "last_name"] as const;
      const hasUserPatch = userFieldKeys.some((k) => k in patch);
      const userId = rec.user_id;
      if (hasUserPatch && userId) {
        const row = await getDb().users.get(userId);
        if (row) {
          const existing = await decryptRow<UserRecord>(row);
          const next: UserRecord = {
            ...existing,
            national_id:
              typeof patch.national_id === "string"
                ? patch.national_id
                : existing.national_id,
            phone_number:
              typeof patch.phone_number === "string"
                ? patch.phone_number
                : existing.phone_number,
            first_name:
              typeof patch.first_name === "string"
                ? patch.first_name
                : existing.first_name,
            last_name:
              typeof patch.last_name === "string"
                ? patch.last_name
                : existing.last_name,
            updated_at: now,
          };
          await upsertUsers([next]);
        }
      }
    },
    async deleteLocal(id) {
      await getDb().teachers.delete(id);
    },
    readBaseUpdatedAt: (id) => readCleartextUpdatedAt("teachers", id),
    serverPayload: (_id, payload) => payload,
  },

  course: {
    resource: "course",
    async upsertCreate(id, payload, now) {
      const rec: CourseRecord = {
        id,
        name: String(payload.name ?? ""),
        description: String(payload.description ?? ""),
        created_at: now,
        updated_at: now,
      };
      await upsertCourses([rec]);
    },
    async readExisting(id) {
      const row = await getDb().courses.get(id);
      if (!row) return undefined;
      return (await decryptRow<CourseRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now) {
      const rec = { ...(merged as unknown as CourseRecord), id, updated_at: now };
      await upsertCourses([rec]);
    },
    async deleteLocal(id) {
      await getDb().courses.delete(id);
    },
    readBaseUpdatedAt: (id) => readCleartextUpdatedAt("courses", id),
    serverPayload: (_id, payload) => payload,
  },

  weekly_plan: {
    resource: "weekly_plan",
    async upsertCreate(id, payload, now) {
      const rec: WeeklyPlanRecord = {
        id,
        student_id: String(payload.student_id ?? ""),
        week_number: Number(payload.week_number ?? 0),
        week_start: String(payload.week_start ?? ""),
        total_required: Number(payload.total_required ?? 0),
        total_achieved: 0,
        created_at: now,
        updated_at: now,
      };
      await upsertWeeklyPlans([rec]);
    },
    async readExisting(id) {
      const row = await getDb().weekly_plans.get(id);
      if (!row) return undefined;
      return (await decryptRow<WeeklyPlanRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now) {
      const rec = { ...(merged as unknown as WeeklyPlanRecord), id, updated_at: now };
      await upsertWeeklyPlans([rec]);
    },
    async deleteLocal(id) {
      await getDb().weekly_plans.delete(id);
    },
    readBaseUpdatedAt: (id) => readCleartextUpdatedAt("weekly_plans", id),
    serverPayload: (_id, payload) => payload,
  },

  daily_record: {
    resource: "daily_record",
    async upsertCreate(id, payload, now) {
      const rec: DailyRecordRecord = {
        id,
        weekly_plan_id: String(payload.weekly_plan_id ?? ""),
        day: (payload.day as DailyRecordRecord["day"]) ?? "sat",
        date: String(payload.date ?? now.slice(0, 10)),
        attendance: (payload.attendance as DailyRecordRecord["attendance"]) ?? "present",
        required_verses: Number(payload.required_verses ?? 0),
        achieved_verses: Number(payload.achieved_verses ?? 0),
        surah_name: String(payload.surah_name ?? ""),
        quality: (payload.quality as DailyRecordRecord["quality"]) ?? "none",
        note: String(payload.note ?? ""),
        result: (payload.result as DailyRecordRecord["result"]) ?? "pending",
        recorded_by_id: null,
        created_at: now,
        updated_at: now,
      };
      await upsertDailyRecords([rec]);
    },
    async readExisting(id) {
      const row = await getDb().daily_records.get(id);
      if (!row) return undefined;
      return (await decryptRow<DailyRecordRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now) {
      const rec = { ...(merged as unknown as DailyRecordRecord), id, updated_at: now };
      await upsertDailyRecords([rec]);
    },
    async deleteLocal(id) {
      await getDb().daily_records.delete(id);
    },
    readBaseUpdatedAt: (id) => readCleartextUpdatedAt("daily_records", id),
    serverPayload: (_id, payload) => payload,
  },

  review_record: {
    resource: "review_record",
    async upsertCreate(id, payload, now) {
      const rec: ReviewRecordRecord = {
        id,
        student_id: String(payload.student_id ?? ""),
        surah_name: String(payload.surah_name ?? ""),
        reviewed_date: String(payload.reviewed_date ?? now.slice(0, 10)),
        quality: String(payload.quality ?? "good"),
        note: String(payload.note ?? ""),
        recorded_by_id: null,
        created_at: now,
        updated_at: now,
      };
      await upsertReviewRecords([rec]);
    },
    async readExisting(id) {
      const row = await getDb().review_records.get(id);
      if (!row) return undefined;
      return (await decryptRow<ReviewRecordRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now) {
      const rec = { ...(merged as unknown as ReviewRecordRecord), id, updated_at: now };
      await upsertReviewRecords([rec]);
    },
    async deleteLocal(id) {
      await getDb().review_records.delete(id);
    },
    readBaseUpdatedAt: (id) => readCleartextUpdatedAt("review_records", id),
    serverPayload: (_id, payload) => payload,
  },

  evaluation: {
    resource: "evaluation",
    async upsertCreate(id, payload, now) {
      const rec: EvaluationRecord = {
        id,
        student_id: String(payload.student_id ?? ""),
        title: String(payload.title ?? ""),
        surah_range: String(payload.surah_range ?? ""),
        scheduled_date: String(payload.scheduled_date ?? now.slice(0, 10)),
        status: String(payload.status ?? "scheduled"),
        result_note: String(payload.result_note ?? ""),
        created_by_id: null,
        created_at: now,
        updated_at: now,
      };
      await upsertEvaluations([rec]);
    },
    async readExisting(id) {
      const row = await getDb().evaluations.get(id);
      if (!row) return undefined;
      return (await decryptRow<EvaluationRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now) {
      const rec = { ...(merged as unknown as EvaluationRecord), id, updated_at: now };
      await upsertEvaluations([rec]);
    },
    async deleteLocal(id) {
      await getDb().evaluations.delete(id);
    },
    readBaseUpdatedAt: (id) => readCleartextUpdatedAt("evaluations", id),
    serverPayload: (_id, payload) => payload,
  },

  // BE `_DISPATCH` supports update only (mark-read). Creation happens
  // server-side via `/api/notifications/announce/`; deletion is unused.
  notification: {
    resource: "notification",
    async readExisting(id) {
      const row = await getDb().notifications.get(id);
      if (!row) return undefined;
      return (await decryptRow<NotificationRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now) {
      const rec = { ...(merged as unknown as NotificationRecord), id, updated_at: now };
      await upsertNotifications([rec]);
    },
    readBaseUpdatedAt: (id) => readCleartextUpdatedAt("notifications", id),
    serverPayload: (_id, payload) => payload,
  },

  student_course: {
    resource: "student_course",
    async upsertCreate(id, payload, now) {
      const rec: StudentCourseRecord = {
        id,
        student_id: String(payload.student_id ?? ""),
        course_id: String(payload.course_id ?? ""),
        is_completed: Boolean(payload.is_completed ?? false),
        completion_date: (payload.completion_date as string) ?? null,
        created_at: now,
        updated_at: now,
      };
      await upsertStudentCourses([rec]);
    },
    async readExisting(id) {
      const row = await getDb().student_courses.get(id);
      if (!row) return undefined;
      return (await decryptRow<StudentCourseRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now) {
      const rec = { ...(merged as unknown as StudentCourseRecord), id, updated_at: now };
      await upsertStudentCourses([rec]);
    },
    async deleteLocal(id) {
      await getDb().student_courses.delete(id);
    },
    readBaseUpdatedAt: (id) => readCleartextUpdatedAt("student_courses", id),
    serverPayload: (_id, payload) => payload,
  },

  // BE `_DISPATCH` supports create + delete only (no update).
  parent_student_link: {
    resource: "parent_student_link",
    async upsertCreate(id, payload, now) {
      const rec: ParentStudentLinkRecord = {
        id,
        parent_id: String(payload.parent_id ?? ""),
        student_id: String(payload.student_id ?? ""),
        created_at: now,
        updated_at: now,
      };
      await upsertParentStudentLinks([rec]);
    },
    async deleteLocal(id) {
      await getDb().parent_student_links.delete(id);
    },
    readBaseUpdatedAt: (id) => readCleartextUpdatedAt("parent_student_links", id),
    serverPayload: (_id, payload) => payload,
  },
};

export function getMutationHandler(r: MutationResource): Handler {
  return handlers[r];
}

// ---------------------------------------------------------------------------
// Runner — what the hook ultimately calls
// ---------------------------------------------------------------------------

export interface RunResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function runMutation(args: {
  resource: MutationResource;
  action: MutationAction;
  /**
   * For `create`: the full server-shaped payload. `id` is minted if absent.
   * For `update`: `{ id, ...patch }` where patch is the subset of fields to change.
   * For `delete`: `{ id }`.
   */
  payload: Payload;
}): Promise<RunResult> {
  const h = handlers[args.resource];
  const now = nowIso();

  try {
    if (args.action === "create") {
      if (!h.upsertCreate) {
        return { ok: false, error: "العملية غير مدعومة لهذا النوع." };
      }
      const id = (args.payload.id as string) || crypto.randomUUID();
      await h.upsertCreate(id, args.payload, now);
      await enqueueOp({
        resource: h.resource,
        action: "create",
        target_id: id,
        payload: h.serverPayload(id, { ...args.payload, id }),
        base_updated_at: null,
        client_updated_at: now,
      });
      emitChange(h.resource);
      return { ok: true, id };
    }

    const id = args.payload.id as string;
    if (!id) return { ok: false, error: "المعرّف مطلوب." };

    if (args.action === "delete") {
      if (!h.deleteLocal) {
        return { ok: false, error: "العملية غير مدعومة لهذا النوع." };
      }
      const base = await h.readBaseUpdatedAt(id);
      await h.deleteLocal(id);
      await enqueueOp({
        resource: h.resource,
        action: "delete",
        target_id: id,
        payload: { id },
        base_updated_at: base,
        client_updated_at: now,
      });
      emitChange(h.resource);
      return { ok: true, id };
    }

    // update
    if (!h.readExisting || !h.upsertUpdate) {
      return { ok: false, error: "العملية غير مدعومة لهذا النوع." };
    }
    const existing = await h.readExisting(id);
    if (!existing) return { ok: false, error: "السجل غير موجود محلياً." };
    const base = await h.readBaseUpdatedAt(id);
    const merged: Payload = { ...existing, ...args.payload };
    await h.upsertUpdate(id, merged, now);
    await enqueueOp({
      resource: h.resource,
      action: "update",
      target_id: id,
      payload: h.serverPayload(id, args.payload),
      base_updated_at: base,
      client_updated_at: now,
    });
    emitChange(h.resource);
    return { ok: true, id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
