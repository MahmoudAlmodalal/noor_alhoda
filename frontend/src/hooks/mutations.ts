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
  listEvaluationsForStudent,
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
import {
  deleteProgressLocal,
  getProgress,
  upsertProgress,
  type ProgressRecord,
} from "@/lib/db/repos/progress";
import { SURAH_BY_NUMBER } from "@/lib/data/surahs";


async function syncEvaluationScoresLocally(
  payload: Record<string, unknown>,
  now: string
): Promise<void> {
  const studentId = String(payload.student_id ?? "");
  const date = String(payload.date ?? now.slice(0, 10));
  if (!studentId) return;

  const candidates = ([
    { type: "scattered" as const, value: payload.scattered_test_score },
    { type: "combined" as const, value: payload.combined_test_score },
  ]).filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
  if (candidates.length === 0) return;

  const evaluations = await listEvaluationsForStudent(studentId);
  const used = new Set<string>();
  const updates: EvaluationRecord[] = [];
  for (const candidate of candidates) {
    const explicitId = payload.evaluation_id ? String(payload.evaluation_id) : null;
    const target = evaluations.find((item) => {
      if (used.has(item.id) || item.evaluation_type !== candidate.type) return false;
      if (explicitId) return item.id === explicitId;
      return item.scheduled_date === date && item.status === "scheduled";
    });
    if (!target) continue;
    used.add(target.id);
    const score = Number(candidate.value);
    const updated: EvaluationRecord = {
      ...target,
      score: String(score),
      status: score >= Number(target.max_score) ? "passed" : "failed",
      updated_at: now,
      server_updated_at: null,
    };
    updates.push(updated);
  }
  if (updates.length > 0) {
    await upsertEvaluations(updates);
    emitChange("evaluation");
  }
}

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
  | "parent_student_link"
  | "progress";

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
  upsertUpdate?(
    id: string,
    merged: Payload,
    nowIso: string,
    serverUpdatedAt: string | null
  ): Promise<void>;
  deleteLocal?(id: string): Promise<void>;
  readBaseUpdatedAt(id: string): Promise<string | null>;
  serverPayload(id: string, localPatchOrFull: Payload): Payload;
}

function nowIso(): string {
  return new Date().toISOString();
}

// The LWW push base: `server_updated_at` is set ONLY from a server-confirmed
// row (push response / pull delta), never by a local optimistic write —
// unlike `updated_at`, which every local edit bumps to the client's own
// clock. Reading the base from `updated_at` instead would make a second
// offline edit to the same record report a false conflict against the
// FIRST edit's own client-clock write and silently discard it. See
// `db/repos/index.ts::resolveServerUpdatedAt`.
async function readServerUpdatedAt(
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
    | "parent_student_links"
    | "progress",
  id: string
): Promise<string | null> {
  const row = await getDb()[table].get(id);
  return (row as { server_updated_at?: string | null } | undefined)?.server_updated_at ?? null;
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
        current_surah: String(payload.current_surah ?? ""),
        current_juz: payload.current_juz != null ? Number(payload.current_juz) : null,
        memorized_verses: Number(payload.memorized_verses ?? 0),
        current_page: payload.current_page != null ? Number(payload.current_page) : null,
        last_course_reached: String(payload.last_course_reached ?? ""),
        enrollment_date: now.slice(0, 10),
        created_at: now,
        updated_at: now,
        server_updated_at: null,
      };
      await upsertStudent(rec);
    },
    async readExisting(id) {
      const r = await getStudent(id);
      return r as unknown as Payload | undefined;
    },
    async upsertUpdate(id, merged, now, serverUpdatedAt) {
      const rec = {
        ...(merged as unknown as StudentRecord),
        id,
        updated_at: now,
        server_updated_at: serverUpdatedAt,
      };
      await upsertStudent(rec);
    },
    async deleteLocal(id) {
      await deleteStudentLocal(id);
    },
    readBaseUpdatedAt: (id) => readServerUpdatedAt("students", id),
    serverPayload: (_id, payload) => payload,
  },

  teacher: {
    resource: "teacher",
    async upsertCreate(id, payload, now) {
      // Mint the User UUID locally so listTeachersWithUser can resolve
      // national_id / phone_number from the local users table immediately
      // — without this the new teacher card flashes empty until the push
      // round-trip completes (or stays empty forever if the user is offline
      // or push fails). Threading it back into payload makes the wire op
      // carry user_id so the server creates the User at the same key.
      const userId =
        typeof payload.user_id === "string" && payload.user_id
          ? (payload.user_id as string)
          : crypto.randomUUID();
      const rec: TeacherRecord = {
        id,
        user_id: userId,
        full_name: String(payload.full_name ?? ""),
        specialization: String(payload.specialization ?? ""),
        session_days: (payload.session_days as string[]) ?? [],
        max_students: Number(payload.max_students ?? 25),
        affiliation: String(payload.affiliation ?? ""),
        ring_name: String(payload.ring_name ?? ""),
        course_ids: (payload.course_ids as string[]) ?? [],
        wallet_name: String(payload.wallet_name ?? ""),
        wallet_number: String(payload.wallet_number ?? ""),
        birthdate: (payload.birthdate as string) ?? null,
        marital_status: String(payload.marital_status ?? ""),
        education_qualification: String(payload.education_qualification ?? ""),
        last_tajweed_course: String(payload.last_tajweed_course ?? ""),
        family_members_count: Number(payload.family_members_count ?? 0),
        job_title: String(payload.job_title ?? ""),
        created_at: now,
        updated_at: now,
        server_updated_at: null,
      };
      const userRec: UserRecord = {
        id: userId,
        national_id: String(payload.national_id ?? ""),
        phone_number: String(payload.phone_number ?? ""),
        first_name: String(payload.first_name ?? ""),
        last_name: String(payload.last_name ?? ""),
        role: "teacher",
        is_active: true,
        date_joined: now,
        updated_at: now,
      };
      (payload as Record<string, unknown>).user_id = userId;
      await upsertTeachers([rec]);
      await upsertUsers([userRec]);
    },
    async readExisting(id) {
      const row = await getDb().teachers.get(id);
      if (!row) return undefined;
      return (await decryptRow<TeacherRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now, serverUpdatedAt) {
      const patch = merged as Payload;
      const rec: TeacherRecord = {
        ...(merged as unknown as TeacherRecord),
        id,
        updated_at: now,
        server_updated_at: serverUpdatedAt,
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
    readBaseUpdatedAt: (id) => readServerUpdatedAt("teachers", id),
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
        server_updated_at: null,
      };
      await upsertCourses([rec]);
    },
    async readExisting(id) {
      const row = await getDb().courses.get(id);
      if (!row) return undefined;
      return (await decryptRow<CourseRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now, serverUpdatedAt) {
      const rec = {
        ...(merged as unknown as CourseRecord),
        id,
        updated_at: now,
        server_updated_at: serverUpdatedAt,
      };
      await upsertCourses([rec]);
    },
    async deleteLocal(id) {
      await getDb().courses.delete(id);
    },
    readBaseUpdatedAt: (id) => readServerUpdatedAt("courses", id),
    serverPayload: (_id, payload) => payload,
  },

  weekly_plan: {
    resource: "weekly_plan",
    async upsertCreate(id, payload, now) {
      const rec: WeeklyPlanRecord = {
        id,
        student_id: String(payload.student_id ?? ""),
        week_number: Number(payload.week_number ?? 0),
        week_start: String(payload.week_start ?? payload.month_start ?? ""),
        month_start: payload.month_start ? String(payload.month_start) : null,
        required_pages: Number(payload.required_pages ?? 0),
        review_required_pages: Number(payload.review_required_pages ?? 0),
        total_required: Number(payload.total_required ?? 0),
        total_required_lines: Number(payload.total_required_lines ?? 0),
        total_achieved: 0,
        total_lines: Number(payload.total_lines ?? 0),
        created_at: now,
        updated_at: now,
        server_updated_at: null,
      };
      await upsertWeeklyPlans([rec]);
    },
    async readExisting(id) {
      const row = await getDb().weekly_plans.get(id);
      if (!row) return undefined;
      return (await decryptRow<WeeklyPlanRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now, serverUpdatedAt) {
      const rec = {
        ...(merged as unknown as WeeklyPlanRecord),
        id,
        updated_at: now,
        server_updated_at: serverUpdatedAt,
      };
      await upsertWeeklyPlans([rec]);
    },
    async deleteLocal(id) {
      await getDb().weekly_plans.delete(id);
    },
    readBaseUpdatedAt: (id) => readServerUpdatedAt("weekly_plans", id),
    serverPayload: (_id, payload) => payload,
  },

  daily_record: {
    resource: "daily_record",
    async upsertCreate(id, payload, now) {
      const fromAyahVal = payload.from_ayah !== null && payload.from_ayah !== undefined && payload.from_ayah !== "" ? Number(payload.from_ayah) : null;
      const toAyahVal = payload.to_ayah !== null && payload.to_ayah !== undefined && payload.to_ayah !== "" ? Number(payload.to_ayah) : null;
      let achVerses = Number(payload.achieved_verses ?? 0);
      if (fromAyahVal !== null && toAyahVal !== null && toAyahVal >= fromAyahVal) {
        achVerses = toAyahVal - fromAyahVal + 1;
      }
      const rec: DailyRecordRecord = {
        id,
        student_id: String(payload.student_id ?? ""),
        weekly_plan_id: payload.weekly_plan_id ? String(payload.weekly_plan_id) : null,
        evaluation_id: payload.evaluation_id ? String(payload.evaluation_id) : null,
        day: (payload.day as DailyRecordRecord["day"]) ?? "sat",
        date: String(payload.date ?? now.slice(0, 10)),
        attendance: (payload.attendance as DailyRecordRecord["attendance"]) ?? "present",
        required_verses: Number(payload.required_verses ?? 0),
        achieved_verses: achVerses,
        from_ayah: fromAyahVal,
        to_ayah: toAyahVal,
        from_page: payload.from_page !== null && payload.from_page !== undefined && payload.from_page !== "" ? Number(payload.from_page) : null,
        to_page: payload.to_page !== null && payload.to_page !== undefined && payload.to_page !== "" ? Number(payload.to_page) : null,
        memorized_lines: Number(payload.memorized_lines ?? 0),
        surah_name: String(payload.surah_name ?? ""),
        quality: (payload.quality as DailyRecordRecord["quality"]) ?? "none",
        morals_rating: (payload.morals_rating as DailyRecordRecord["morals_rating"]) ?? "none",
        scattered_test_score: payload.scattered_test_score == null || payload.scattered_test_score === "" ? null : Number(payload.scattered_test_score),
        combined_test_score: payload.combined_test_score == null || payload.combined_test_score === "" ? null : Number(payload.combined_test_score),
        note: String(payload.note ?? ""),
        result: (payload.result as DailyRecordRecord["result"]) ?? "pending",
        recorded_by_id: null,
        created_at: now,
        updated_at: now,
        review_surah_name: String(payload.review_surah_name ?? ""),
        review_from_ayah: payload.review_from_ayah !== null && payload.review_from_ayah !== undefined && payload.review_from_ayah !== "" ? Number(payload.review_from_ayah) : null,
        review_to_ayah: payload.review_to_ayah !== null && payload.review_to_ayah !== undefined && payload.review_to_ayah !== "" ? Number(payload.review_to_ayah) : null,
        review_from_page: payload.review_from_page !== null && payload.review_from_page !== undefined && payload.review_from_page !== "" ? Number(payload.review_from_page) : null,
        review_to_page: payload.review_to_page !== null && payload.review_to_page !== undefined && payload.review_to_page !== "" ? Number(payload.review_to_page) : null,
        review_quality: (payload.review_quality as DailyRecordRecord["review_quality"]) ?? "none",
        next_memorization_target: String(payload.next_memorization_target ?? ""),
        next_memorization_from_ayah: payload.next_memorization_from_ayah !== null && payload.next_memorization_from_ayah !== undefined && payload.next_memorization_from_ayah !== "" ? Number(payload.next_memorization_from_ayah) : null,
        next_memorization_to_ayah: payload.next_memorization_to_ayah !== null && payload.next_memorization_to_ayah !== undefined && payload.next_memorization_to_ayah !== "" ? Number(payload.next_memorization_to_ayah) : null,
        next_review_target: String(payload.next_review_target ?? ""),
        next_review_from_ayah: payload.next_review_from_ayah !== null && payload.next_review_from_ayah !== undefined && payload.next_review_from_ayah !== "" ? Number(payload.next_review_from_ayah) : null,
        next_review_to_ayah: payload.next_review_to_ayah !== null && payload.next_review_to_ayah !== undefined && payload.next_review_to_ayah !== "" ? Number(payload.next_review_to_ayah) : null,
        server_updated_at: null,
      };
      await upsertDailyRecords([rec]);
      await syncEvaluationScoresLocally(payload, now);
    },
    async readExisting(id) {
      const row = await getDb().daily_records.get(id);
      if (!row) return undefined;
      return (await decryptRow<DailyRecordRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now, serverUpdatedAt) {
      const rec = {
        ...(merged as unknown as DailyRecordRecord),
        id,
        updated_at: now,
        server_updated_at: serverUpdatedAt,
      };
      await upsertDailyRecords([rec]);
      await syncEvaluationScoresLocally(rec as unknown as Record<string, unknown>, now);
    },
    async deleteLocal(id) {
      await getDb().daily_records.delete(id);
    },
    readBaseUpdatedAt: (id) => readServerUpdatedAt("daily_records", id),
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
        server_updated_at: null,
      };
      await upsertReviewRecords([rec]);
    },
    async readExisting(id) {
      const row = await getDb().review_records.get(id);
      if (!row) return undefined;
      return (await decryptRow<ReviewRecordRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now, serverUpdatedAt) {
      const rec = {
        ...(merged as unknown as ReviewRecordRecord),
        id,
        updated_at: now,
        server_updated_at: serverUpdatedAt,
      };
      await upsertReviewRecords([rec]);
    },
    async deleteLocal(id) {
      await getDb().review_records.delete(id);
    },
    readBaseUpdatedAt: (id) => readServerUpdatedAt("review_records", id),
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
        evaluation_type: (payload.evaluation_type as "scattered" | "combined") ?? "scattered",
        score: payload.score === null || payload.score === undefined || payload.score === "" ? null : String(payload.score),
        max_score: String(payload.max_score ?? 100),
        created_by_id: null,
        created_at: now,
        updated_at: now,
        server_updated_at: null,
      };
      await upsertEvaluations([rec]);
    },
    async readExisting(id) {
      const row = await getDb().evaluations.get(id);
      if (!row) return undefined;
      return (await decryptRow<EvaluationRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now, serverUpdatedAt) {
      const rec = {
        ...(merged as unknown as EvaluationRecord),
        id,
        updated_at: now,
        server_updated_at: serverUpdatedAt,
      };
      await upsertEvaluations([rec]);
    },
    async deleteLocal(id) {
      await getDb().evaluations.delete(id);
    },
    readBaseUpdatedAt: (id) => readServerUpdatedAt("evaluations", id),
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
    async upsertUpdate(id, merged, now, serverUpdatedAt) {
      const rec = {
        ...(merged as unknown as NotificationRecord),
        id,
        updated_at: now,
        server_updated_at: serverUpdatedAt,
      };
      await upsertNotifications([rec]);
    },
    readBaseUpdatedAt: (id) => readServerUpdatedAt("notifications", id),
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
        server_updated_at: null,
      };
      await upsertStudentCourses([rec]);
    },
    async readExisting(id) {
      const row = await getDb().student_courses.get(id);
      if (!row) return undefined;
      return (await decryptRow<StudentCourseRecord>(row)) as unknown as Payload;
    },
    async upsertUpdate(id, merged, now, serverUpdatedAt) {
      const rec = {
        ...(merged as unknown as StudentCourseRecord),
        id,
        updated_at: now,
        server_updated_at: serverUpdatedAt,
      };
      await upsertStudentCourses([rec]);
    },
    async deleteLocal(id) {
      await getDb().student_courses.delete(id);
    },
    readBaseUpdatedAt: (id) => readServerUpdatedAt("student_courses", id),
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
        server_updated_at: null,
      };
      await upsertParentStudentLinks([rec]);
    },
    async deleteLocal(id) {
      await getDb().parent_student_links.delete(id);
    },
    readBaseUpdatedAt: (id) => readServerUpdatedAt("parent_student_links", id),
    serverPayload: (_id, payload) => payload,
  },

  progress: {
    resource: "progress",
    async upsertCreate(id, payload, now) {
      const surahNum = Number(payload.surah_number ?? 1);
      const surahData = SURAH_BY_NUMBER.get(surahNum);
      const rec: ProgressRecord = {
        id,
        student_id: String(payload.student_id ?? ""),
        teacher_id: (payload.teacher_id as string) ?? null,
        surah_number: surahNum,
        surah_name: surahData?.name_ar ?? "",
        juz_number: Number(payload.juz_number ?? 1),
        from_ayah: payload.from_ayah != null ? Number(payload.from_ayah) : null,
        to_ayah: payload.to_ayah != null ? Number(payload.to_ayah) : null,
        type: (payload.type as "memorization" | "revision") ?? "memorization",
        note: String(payload.note ?? ""),
        recorded_at: now,
        created_at: now,
        updated_at: now,
        server_updated_at: null,
      };
      await upsertProgress(rec);
    },
    async readExisting(id) {
      return (await getProgress(id)) as Payload | undefined;
    },
    async upsertUpdate(id, merged, now, serverUpdatedAt) {
      const surahNum = Number(merged.surah_number ?? 1);
      const surahData = SURAH_BY_NUMBER.get(surahNum);
      const rec: ProgressRecord = {
        id,
        student_id: String(merged.student_id ?? ""),
        teacher_id: (merged.teacher_id as string) ?? null,
        surah_number: surahNum,
        surah_name: surahData?.name_ar ?? String(merged.surah_name ?? ""),
        juz_number: Number(merged.juz_number ?? 1),
        from_ayah: merged.from_ayah != null ? Number(merged.from_ayah) : null,
        to_ayah: merged.to_ayah != null ? Number(merged.to_ayah) : null,
        type: (merged.type as "memorization" | "revision") ?? "memorization",
        note: String(merged.note ?? ""),
        recorded_at: (merged.recorded_at as string) ?? now,
        created_at: (merged.created_at as string) ?? now,
        updated_at: now,
        server_updated_at: serverUpdatedAt,
      };
      await upsertProgress(rec);
    },
    async deleteLocal(id) {
      await deleteProgressLocal(id);
    },
    readBaseUpdatedAt: (id) => readServerUpdatedAt("progress", id),
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
    await h.upsertUpdate(id, merged, now, base);
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
