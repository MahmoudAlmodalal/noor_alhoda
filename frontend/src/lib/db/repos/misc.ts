/**
 * Repositories for the smaller resources that still need a pull-time
 * upsert path but don't yet have bespoke query methods. Added in Phase 1
 * so the pull runner can stash them; dedicated query APIs come as pages
 * are migrated off the online API.
 */
import {
  getDb,
  type CourseRow,
  type EvaluationRow,
  type NotificationRow,
  type ParentRow,
  type ParentStudentLinkRow,
  type StudentCourseRow,
  type TeacherRow,
  type UserRow,
} from "../schema";
import { decryptRows, encryptForRow } from "./index";

// Pure plaintext shapes — match the server's pull serializer.
export interface UserRecord {
  id: string;
  national_id: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  date_joined: string | null;
  updated_at: string | null;
}
export interface TeacherRecord {
  id: string;
  user_id: string;
  full_name: string;
  specialization: string;
  session_days: string[];
  max_students: number;
  affiliation: string;
  ring_name: string;
  course_ids: string[];
  created_at: string | null;
  updated_at: string | null;
}
export interface ParentRecord {
  id: string;
  user_id: string;
  full_name: string;
  phone_number: string;
  created_at: string | null;
  updated_at: string | null;
}
export interface ParentStudentLinkRecord {
  id: string;
  parent_id: string;
  student_id: string;
  created_at: string | null;
  updated_at: string | null;
}
export interface EvaluationRecord {
  id: string;
  student_id: string;
  title: string;
  surah_range: string;
  scheduled_date: string;
  status: string;
  result_note: string;
  created_by_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}
export interface NotificationRecord {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string | null;
  updated_at: string | null;
}
export interface CourseRecord {
  id: string;
  name: string;
  description: string;
  created_at: string | null;
  updated_at: string | null;
}
export interface StudentCourseRecord {
  id: string;
  student_id: string;
  course_id: string;
  is_completed: boolean;
  completion_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function upsertUsers(rows: UserRecord[]): Promise<void> {
  const enc: UserRow[] = await Promise.all(
    rows.map((r) =>
      encryptForRow(r, {
        id: r.id,
        updated_at: r.updated_at ?? r.date_joined ?? "",
        national_id: r.national_id,
        role: r.role,
      })
    )
  );
  await getDb().users.bulkPut(enc);
}

export async function upsertTeachers(rows: TeacherRecord[]): Promise<void> {
  const enc: TeacherRow[] = await Promise.all(
    rows.map((r) =>
      encryptForRow(r, {
        id: r.id,
        updated_at: r.updated_at ?? r.created_at ?? "",
        user_id: r.user_id,
      })
    )
  );
  await getDb().teachers.bulkPut(enc);
}

export async function upsertParents(rows: ParentRecord[]): Promise<void> {
  const enc: ParentRow[] = await Promise.all(
    rows.map((r) =>
      encryptForRow(r, {
        id: r.id,
        updated_at: r.updated_at ?? r.created_at ?? "",
        user_id: r.user_id,
      })
    )
  );
  await getDb().parents.bulkPut(enc);
}

export async function upsertParentStudentLinks(
  rows: ParentStudentLinkRecord[]
): Promise<void> {
  const enc: ParentStudentLinkRow[] = await Promise.all(
    rows.map((r) =>
      encryptForRow(r, {
        id: r.id,
        updated_at: r.updated_at ?? r.created_at ?? "",
        parent_id: r.parent_id,
        student_id: r.student_id,
      })
    )
  );
  await getDb().parent_student_links.bulkPut(enc);
}

export async function upsertEvaluations(
  rows: EvaluationRecord[]
): Promise<void> {
  const enc: EvaluationRow[] = await Promise.all(
    rows.map((r) =>
      encryptForRow(r, {
        id: r.id,
        updated_at: r.updated_at ?? r.created_at ?? "",
        student_id: r.student_id,
        scheduled_date: r.scheduled_date,
        status: r.status,
      })
    )
  );
  await getDb().evaluations.bulkPut(enc);
}

export async function upsertNotifications(
  rows: NotificationRecord[]
): Promise<void> {
  const enc: NotificationRow[] = await Promise.all(
    rows.map((r) =>
      encryptForRow(r, {
        id: r.id,
        updated_at: r.updated_at ?? r.created_at ?? "",
        recipient_id: r.recipient_id,
        is_read: r.is_read ? 1 : 0,
        created_at: r.created_at ?? "",
      })
    )
  );
  await getDb().notifications.bulkPut(enc);
}

export async function upsertCourses(rows: CourseRecord[]): Promise<void> {
  const enc: CourseRow[] = await Promise.all(
    rows.map((r) =>
      encryptForRow(r, {
        id: r.id,
        updated_at: r.updated_at ?? r.created_at ?? "",
        name: r.name,
      })
    )
  );
  await getDb().courses.bulkPut(enc);
}

export async function upsertStudentCourses(
  rows: StudentCourseRecord[]
): Promise<void> {
  const enc: StudentCourseRow[] = await Promise.all(
    rows.map((r) =>
      encryptForRow(r, {
        id: r.id,
        updated_at: r.updated_at ?? r.created_at ?? "",
        student_id: r.student_id,
        course_id: r.course_id,
      })
    )
  );
  await getDb().student_courses.bulkPut(enc);
}

// ---------------------------------------------------------------------------
// Simple read helpers (used by teacher screens in Phase 1)
// ---------------------------------------------------------------------------

export async function listTeachers(): Promise<TeacherRecord[]> {
  const rows = await getDb().teachers.toArray();
  return decryptRows<TeacherRecord>(rows);
}

export async function listUsers(): Promise<UserRecord[]> {
  const rows = await getDb().users.toArray();
  return decryptRows<UserRecord>(rows);
}

export async function getUser(id: string): Promise<UserRecord | undefined> {
  const row = await getDb().users.get(id);
  if (!row) return undefined;
  const [dec] = await decryptRows<UserRecord>([row]);
  return dec;
}

export async function listEvaluationsForStudent(
  student_id: string
): Promise<EvaluationRecord[]> {
  const rows = await getDb()
    .evaluations.where("student_id")
    .equals(student_id)
    .toArray();
  const decrypted = await decryptRows<EvaluationRecord>(rows);
  decrypted.sort((a, b) => (a.scheduled_date < b.scheduled_date ? -1 : 1));
  return decrypted;
}

export async function listNotificationsForUser(
  user_id: string
): Promise<NotificationRecord[]> {
  const rows = await getDb()
    .notifications.where("recipient_id")
    .equals(user_id)
    .toArray();
  const decrypted = await decryptRows<NotificationRecord>(rows);
  decrypted.sort((a, b) =>
    (a.created_at ?? "") < (b.created_at ?? "") ? 1 : -1
  );
  return decrypted;
}

export async function listCourses(): Promise<CourseRecord[]> {
  const rows = await getDb().courses.toArray();
  return decryptRows<CourseRecord>(rows);
}
