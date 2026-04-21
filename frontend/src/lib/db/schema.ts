/**
 * Dexie schema for the offline local database.
 *
 * Every domain table stores encrypted records (EncryptedBlob) keyed by
 * the server-assigned UUID. Non-sensitive indexable columns (updated_at,
 * teacher_id, etc.) are kept in clear so Dexie can answer filtered
 * queries without decrypting the whole table.
 *
 * The `auth` table holds the wrapped DB key, the password verifier, and
 * session metadata. It is intentionally plain-text because its contents
 * cannot be used to decrypt the DB without the user's password.
 */

import Dexie, { type EntityTable } from "dexie";

import type { EncryptedBlob } from "./crypto";

export const DB_NAME = "noor_alhuda_local";
export const DB_VERSION = 2;

export interface EncryptedRow extends EncryptedBlob {
  id: string; // UUID (server-assigned)
  updated_at: string; // ISO, clear for delta queries
}

export interface StudentRow extends EncryptedRow {
  teacher_id: string | null; // clear for teacher-scoped queries
  national_id: string; // clear for offline duplicate-check on push
}

export interface WeeklyPlanRow extends EncryptedRow {
  student_id: string;
  week_start: string; // ISO date
}

export interface DailyRecordRow extends EncryptedRow {
  weekly_plan_id: string;
  date: string; // ISO date, clear for range queries
  day: string;
}

export interface EvaluationRow extends EncryptedRow {
  student_id: string;
  scheduled_date: string;
  status: string;
}

export interface NotificationRow extends EncryptedRow {
  recipient_id: string;
  is_read: number; // 0/1 — Dexie doesn't index booleans
  created_at: string;
}

export interface ReviewRecordRow extends EncryptedRow {
  student_id: string;
  reviewed_date: string;
}

export interface ParentStudentLinkRow extends EncryptedRow {
  parent_id: string;
  student_id: string;
}

export interface StudentCourseRow extends EncryptedRow {
  student_id: string;
  course_id: string;
}

export interface UserRow extends EncryptedRow {
  national_id: string;
  role: string;
}

export interface TeacherRow extends EncryptedRow {
  user_id: string;
}

export interface ParentRow extends EncryptedRow {
  user_id: string;
}

export interface CourseRow extends EncryptedRow {
  name: string;
}

export interface TombstoneRow {
  // Composite key "<resource>:<uuid>" so duplicate tombstones are
  // idempotent.
  key: string;
  resource: string;
  uuid: string;
  deleted_at: string;
}

export interface OutboxRow {
  op_id: string; // UUIDv4 generated client-side
  resource: string;
  action: "create" | "update" | "delete";
  target_id: string; // UUID of the record this op targets (client-minted for create)
  payload_iv: string; // EncryptedBlob split into indexable columns
  payload_ct: string;
  base_updated_at: string | null; // server's updated_at at the time client started editing
  client_updated_at: string;
  created_at: string;
  status: "pending" | "in_flight" | "synced" | "conflict" | "error";
  attempts: number;
  last_error: string | null;
}

export interface AuthRow {
  id: "current"; // single-row table
  user_national_id: string;
  user_id: string;
  user_role: string;
  wrapped_dbk: string;
  salt: string;
  iterations: number;
  verifier_hash: string; // bcrypt hash of password, for offline login
  last_sync_at: string | null; // ISO timestamp, null means full pull required
  created_at: string;
}

export class LocalDb extends Dexie {
  users!: EntityTable<UserRow, "id">;
  teachers!: EntityTable<TeacherRow, "id">;
  parents!: EntityTable<ParentRow, "id">;
  parent_student_links!: EntityTable<ParentStudentLinkRow, "id">;
  students!: EntityTable<StudentRow, "id">;
  weekly_plans!: EntityTable<WeeklyPlanRow, "id">;
  daily_records!: EntityTable<DailyRecordRow, "id">;
  review_records!: EntityTable<ReviewRecordRow, "id">;
  evaluations!: EntityTable<EvaluationRow, "id">;
  notifications!: EntityTable<NotificationRow, "id">;
  courses!: EntityTable<CourseRow, "id">;
  student_courses!: EntityTable<StudentCourseRow, "id">;
  tombstones!: EntityTable<TombstoneRow, "key">;
  outbox!: EntityTable<OutboxRow, "op_id">;
  auth!: EntityTable<AuthRow, "id">;

  constructor() {
    super(DB_NAME);

    // v1 — original shape. Kept for the upgrade path.
    this.version(1).stores({
      users: "id, updated_at, national_id, role",
      teachers: "id, updated_at, user_id",
      parents: "id, updated_at, user_id",
      parent_student_links: "id, updated_at, parent_id, student_id",
      students: "id, updated_at, teacher_id, national_id",
      weekly_plans: "id, updated_at, student_id, week_start",
      daily_records:
        "id, updated_at, weekly_plan_id, date, [weekly_plan_id+day]",
      review_records: "id, updated_at, student_id, reviewed_date",
      evaluations: "id, updated_at, student_id, scheduled_date, status",
      notifications: "id, updated_at, recipient_id, is_read, created_at",
      courses: "id, updated_at, name",
      student_courses: "id, updated_at, student_id, course_id",
      tombstones: "key, resource, deleted_at",
      outbox: "op_id, status, created_at, resource",
      auth: "id",
    });

    // v2 — outbox gains `target_id` and `base_updated_at` to support LWW
    // push and per-record pending-sync badges.
    this.version(2)
      .stores({
        users: "id, updated_at, national_id, role",
        teachers: "id, updated_at, user_id",
        parents: "id, updated_at, user_id",
        parent_student_links: "id, updated_at, parent_id, student_id",
        students: "id, updated_at, teacher_id, national_id",
        weekly_plans: "id, updated_at, student_id, week_start",
        daily_records:
          "id, updated_at, weekly_plan_id, date, [weekly_plan_id+day]",
        review_records: "id, updated_at, student_id, reviewed_date",
        evaluations: "id, updated_at, student_id, scheduled_date, status",
        notifications: "id, updated_at, recipient_id, is_read, created_at",
        courses: "id, updated_at, name",
        student_courses: "id, updated_at, student_id, course_id",
        tombstones: "key, resource, deleted_at",
        outbox:
          "op_id, status, created_at, resource, target_id, [resource+target_id]",
        auth: "id",
      })
      .upgrade(async (tx) => {
        // Backfill target_id + base_updated_at on any v1 outbox rows.
        await tx.table("outbox").toCollection().modify((row) => {
          if (row.target_id === undefined) row.target_id = "";
          if (row.base_updated_at === undefined) row.base_updated_at = null;
        });
      });
  }
}

let _db: LocalDb | null = null;

export function getDb(): LocalDb {
  if (_db === null) _db = new LocalDb();
  return _db;
}

export async function wipeDb(): Promise<void> {
  const db = getDb();
  await db.delete();
  _db = null;
}
