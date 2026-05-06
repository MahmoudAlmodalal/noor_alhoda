/**
 * Pull sync: fetch the delta of visible records from the server and
 * upsert into the encrypted local DB. Triggered on app boot, on the
 * `online` window event, and on a 30s heartbeat while the tab is
 * focused. Concurrent calls coalesce — only one pull runs at a time.
 */
import { api } from "@/lib/api";

import { hasSessionKey, markSyncAt, readAuth, updateSyncGeneration } from "../db/auth";
import { emitChanges, type ResourceName } from "../db/events";
import { getDb, wipeDb } from "../db/schema";
import {
  upsertCourses,
  upsertEvaluations,
  upsertNotifications,
  upsertParents,
  upsertParentStudentLinks,
  upsertStudentCourses,
  upsertTeachers,
  upsertUsers,
  type CourseRecord,
  type EvaluationRecord,
  type NotificationRecord,
  type ParentRecord,
  type ParentStudentLinkRecord,
  type StudentCourseRecord,
  type TeacherRecord,
  type UserRecord,
} from "../db/repos/misc";
import {
  upsertDailyRecords,
  upsertReviewRecords,
  upsertWeeklyPlans,
  type DailyRecordRecord,
  type ReviewRecordRecord,
  type WeeklyPlanRecord,
} from "../db/repos/records";
import {
  upsertStudents,
  type StudentRecord,
} from "../db/repos/students";

export interface SyncPullResponse {
  resources: {
    users: UserRecord[];
    teachers: TeacherRecord[];
    parents: ParentRecord[];
    parent_student_links: ParentStudentLinkRecord[];
    students: StudentRecord[];
    weekly_plans: WeeklyPlanRecord[];
    daily_records: DailyRecordRecord[];
    review_records: ReviewRecordRecord[];
    evaluations: EvaluationRecord[];
    notifications: NotificationRecord[];
    courses: CourseRecord[];
    student_courses: StudentCourseRecord[];
  };
  tombstones: { resource: string; uuid: string; deleted_at: string }[];
  server_time: string;
  sync_generation: string;
}

let pullInFlight: Promise<PullResult> | null = null;

export interface PullResult {
  ok: boolean;
  server_time?: string;
  error?: string;
}

export async function pullSync(): Promise<PullResult> {
  if (pullInFlight !== null) return pullInFlight;
  pullInFlight = (async () => {
    try {
      if (!hasSessionKey()) {
        return { ok: false, error: "DB session locked" };
      }
      const auth = await readAuth();
      const since = auth?.last_sync_at ?? null;

      const qs = since ? `?since=${encodeURIComponent(since)}` : "";
      const res = await api.get<SyncPullResponse>(`/api/sync/pull/${qs}`);

      if (!res.success) {
        return { ok: false, error: res.error.message };
      }

      // Check if server's sync generation differs from client's stored generation.
      // If so, the server DB was reset — wipe local IndexedDB and do a full re-sync.
      const currentAuth = await readAuth();
      const serverGeneration = res.data.sync_generation;
      if (currentAuth && currentAuth.sync_generation !== null && currentAuth.sync_generation !== serverGeneration) {
        // Server DB was reset. Wipe local DB and re-initialize for a fresh full pull.
        await wipeDb();
        return { ok: true, server_time: res.data.server_time };
      }

      await applyPullResponse(res.data);
      return { ok: true, server_time: res.data.server_time };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      pullInFlight = null;
    }
  })();
  return pullInFlight;
}

/**
 * Apply a full pull response to the local encrypted DB: upsert each
 * resource in FK-safe order, apply tombstones, emit change events, and
 * mark the sync timestamp. Shared by `pullSync` (delta) and
 * `downloadFullDb` (initial full download).
 */
export async function applyPullResponse(
  data: SyncPullResponse,
  onTableProgress?: (table: string, done: number, total: number) => void
): Promise<void> {
  const { resources, tombstones, server_time, sync_generation } = data;

  // Order matters for FK consistency: parents/users before links,
  // students before plans, plans before daily records, etc.
  const steps: Array<{ name: string; resource: ResourceName; run: () => Promise<void> }> = [
    { name: "users", resource: "student", run: async () => { if (resources.users.length) await upsertUsers(resources.users); } },
    { name: "teachers", resource: "teacher", run: async () => { if (resources.teachers.length) await upsertTeachers(resources.teachers); } },
    { name: "parents", resource: "parent", run: async () => { if (resources.parents.length) await upsertParents(resources.parents); } },
    { name: "students", resource: "student", run: async () => { if (resources.students.length) await upsertStudents(resources.students); } },
    { name: "parent_student_links", resource: "parent_student_link", run: async () => { if (resources.parent_student_links.length) await upsertParentStudentLinks(resources.parent_student_links); } },
    { name: "weekly_plans", resource: "weekly_plan", run: async () => { if (resources.weekly_plans.length) await upsertWeeklyPlans(resources.weekly_plans); } },
    { name: "daily_records", resource: "daily_record", run: async () => { if (resources.daily_records.length) await upsertDailyRecords(resources.daily_records); } },
    { name: "review_records", resource: "review_record", run: async () => { if (resources.review_records.length) await upsertReviewRecords(resources.review_records); } },
    { name: "evaluations", resource: "evaluation", run: async () => { if (resources.evaluations.length) await upsertEvaluations(resources.evaluations); } },
    { name: "notifications", resource: "notification", run: async () => { if (resources.notifications.length) await upsertNotifications(resources.notifications); } },
    { name: "courses", resource: "course", run: async () => { if (resources.courses.length) await upsertCourses(resources.courses); } },
    { name: "student_courses", resource: "student_course", run: async () => { if (resources.student_courses.length) await upsertStudentCourses(resources.student_courses); } },
  ];

  const touched = new Set<ResourceName>();
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    await step.run();
    const arr = (resources as unknown as Record<string, unknown[]>)[step.name];
    if (arr && arr.length) touched.add(step.resource);
    onTableProgress?.(step.name, i + 1, steps.length);
  }

  if (tombstones.length > 0) {
    await applyTombstones(tombstones);
    for (const t of tombstones) touched.add(t.resource as ResourceName);
  }

  if (touched.size > 0) emitChanges(Array.from(touched));
  await markSyncAt(server_time);
  await updateSyncGeneration(sync_generation);
}

async function applyTombstones(
  tombstones: { resource: string; uuid: string; deleted_at: string }[]
): Promise<void> {
  const db = getDb();
  for (const t of tombstones) {
    switch (t.resource) {
      case "student":
        await db.students.delete(t.uuid);
        break;
      case "teacher":
        await db.teachers.delete(t.uuid);
        break;
      case "parent":
        await db.parents.delete(t.uuid);
        break;
      case "parent_student_link":
        await db.parent_student_links.delete(t.uuid);
        break;
      case "weekly_plan":
        await db.weekly_plans.delete(t.uuid);
        break;
      case "daily_record":
        await db.daily_records.delete(t.uuid);
        break;
      case "review_record":
        await db.review_records.delete(t.uuid);
        break;
      case "evaluation":
        await db.evaluations.delete(t.uuid);
        break;
      case "notification":
        await db.notifications.delete(t.uuid);
        break;
      case "course":
        await db.courses.delete(t.uuid);
        break;
      case "student_course":
        await db.student_courses.delete(t.uuid);
        break;
    }
    await db.tombstones.put({
      key: `${t.resource}:${t.uuid}`,
      resource: t.resource,
      uuid: t.uuid,
      deleted_at: t.deleted_at,
    });
  }
}
