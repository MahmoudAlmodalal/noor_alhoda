/**
 * Local-first Student operations. Reads come from the encrypted Dexie
 * mirror; writes mint a UUID client-side, apply optimistically, and
 * enqueue an outbox op for the next push.
 */
import { emitChange } from "../db/events";
import {
  deleteStudentLocal,
  getStudent,
  listStudents as listStudentsRepo,
  upsertStudent,
  type StudentRecord,
} from "../db/repos/students";
import { getDb } from "../db/schema";
import { enqueueOp } from "../sync/outbox";
import { triggerPush } from "../sync/push";

export type { StudentRecord };

export type CreateStudentInput = Omit<
  StudentRecord,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export async function listStudents(params?: {
  teacher_id?: string;
  search?: string;
}): Promise<StudentRecord[]> {
  return listStudentsRepo(params);
}

export { getStudent };

export async function createStudent(
  input: CreateStudentInput
): Promise<StudentRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const record: StudentRecord = {
    ...input,
    id,
    user_id: "", // server mints the User; stays empty until pull fills it
    created_at: now,
    updated_at: now,
  };
  await upsertStudent(record);
  await enqueueOp({
    resource: "student",
    action: "create",
    target_id: id,
    payload: input,
    base_updated_at: null,
    client_updated_at: now,
  });
  emitChange("student");
  void triggerPush();
  return record;
}

export async function updateStudent(
  id: string,
  patch: Partial<StudentRecord>
): Promise<StudentRecord> {
  const current = await getStudent(id);
  if (!current) {
    throw new Error("الطالب غير موجود في النسخة المحلية.");
  }
  const base = current.updated_at;
  const now = new Date().toISOString();
  const next: StudentRecord = { ...current, ...patch, id, updated_at: now };
  await upsertStudent(next);
  await enqueueOp({
    resource: "student",
    action: "update",
    target_id: id,
    payload: patch,
    base_updated_at: base,
    client_updated_at: now,
  });
  emitChange("student");
  void triggerPush();
  return next;
}

export async function deleteStudent(id: string): Promise<void> {
  const current = await getStudent(id);
  const base = current?.updated_at ?? null;
  const now = new Date().toISOString();
  await deleteStudentLocal(id);
  // Record a local tombstone so other screens don't render the stale row
  // even before the server round-trips.
  await getDb().tombstones.put({
    key: `student:${id}`,
    resource: "student",
    uuid: id,
    deleted_at: now,
  });
  await enqueueOp({
    resource: "student",
    action: "delete",
    target_id: id,
    payload: {},
    base_updated_at: base,
    client_updated_at: now,
  });
  emitChange("student");
  void triggerPush();
}

export async function assignTeacher(
  studentId: string,
  teacherId: string | null
): Promise<StudentRecord> {
  return updateStudent(studentId, { teacher_id: teacherId });
}

export async function setReviewIntervalDays(
  studentId: string,
  days: number
): Promise<StudentRecord> {
  return updateStudent(studentId, { review_interval_days: days });
}
