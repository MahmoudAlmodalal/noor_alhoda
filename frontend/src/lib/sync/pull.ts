/**
 * Pull sync: fetch the delta of visible records from the server and
 * upsert into the encrypted local DB. Triggered on app boot, on the
 * `online` window event, and on a 30s heartbeat while the tab is
 * focused. Concurrent calls coalesce — only one pull runs at a time.
 */
import { api } from "@/lib/api";

import { hasSessionKey, markSyncAt, readAuth } from "../db/auth";
import { getDb } from "../db/schema";
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

interface SyncPullResponse {
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
      const { resources, tombstones, server_time } = res.data;

      // Order matters for FK consistency: parents/users before links,
      // students before plans, plans before daily records, etc.
      if (resources.users.length) await upsertUsers(resources.users);
      if (resources.teachers.length) await upsertTeachers(resources.teachers);
      if (resources.parents.length) await upsertParents(resources.parents);
      if (resources.students.length) await upsertStudents(resources.students);
      if (resources.parent_student_links.length)
        await upsertParentStudentLinks(resources.parent_student_links);
      if (resources.weekly_plans.length)
        await upsertWeeklyPlans(resources.weekly_plans);
      if (resources.daily_records.length)
        await upsertDailyRecords(resources.daily_records);
      if (resources.review_records.length)
        await upsertReviewRecords(resources.review_records);
      if (resources.evaluations.length)
        await upsertEvaluations(resources.evaluations);
      if (resources.notifications.length)
        await upsertNotifications(resources.notifications);
      if (resources.courses.length) await upsertCourses(resources.courses);
      if (resources.student_courses.length)
        await upsertStudentCourses(resources.student_courses);

      if (tombstones.length > 0) await applyTombstones(tombstones);

      await markSyncAt(server_time);
      return { ok: true, server_time };
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
