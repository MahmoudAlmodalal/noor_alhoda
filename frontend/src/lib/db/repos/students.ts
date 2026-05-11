import { getDb } from "../schema";
import { decryptRow, decryptRows, encryptForRow } from "./index";

export interface StudentRecord {
  id: string;
  user_id: string;
  full_name: string;
  national_id: string;
  birthdate: string | null;
  grade: string;
  address: string;
  whatsapp: string;
  mobile: string;
  previous_courses: string;
  desired_courses: string;
  guardian_name: string;
  guardian_national_id: string;
  guardian_mobile: string;
  teacher_id: string | null;
  health_status: string;
  health_note: string;
  skills: Record<string, boolean | string>;
  review_interval_days: number;
  current_surah: string;
  current_juz: number | null;
  memorized_verses: number;
  current_page: number | null;
  enrollment_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function upsertStudent(s: StudentRecord): Promise<void> {
  const encrypted = await encryptForRow(s, {
    id: s.id,
    updated_at: s.updated_at ?? "",
    teacher_id: s.teacher_id,
    national_id: s.national_id,
  });
  await getDb().students.put(encrypted);
}

export async function upsertStudents(rows: StudentRecord[]): Promise<void> {
  const encrypted = await Promise.all(
    rows.map((s) =>
      encryptForRow(s, {
        id: s.id,
        updated_at: s.updated_at ?? "",
        teacher_id: s.teacher_id,
        national_id: s.national_id,
      })
    )
  );
  await getDb().students.bulkPut(encrypted);
}

export async function getStudent(id: string): Promise<StudentRecord | undefined> {
  const row = await getDb().students.get(id);
  if (!row) return undefined;
  return decryptRow<StudentRecord>(row);
}

export async function listStudents(params?: {
  teacher_id?: string;
  search?: string;
}): Promise<StudentRecord[]> {
  const db = getDb();
  const rows = params?.teacher_id
    ? await db.students.where("teacher_id").equals(params.teacher_id).toArray()
    : await db.students.toArray();
  const decrypted = await decryptRows<StudentRecord>(rows);

  const q = params?.search?.trim();
  if (!q) return decrypted;
  const needle = q.toLowerCase();
  return decrypted.filter(
    (s) =>
      s.full_name.toLowerCase().includes(needle) ||
      s.national_id.toLowerCase().includes(needle)
  );
}

export async function deleteStudentLocal(id: string): Promise<void> {
  await getDb().students.delete(id);
}
