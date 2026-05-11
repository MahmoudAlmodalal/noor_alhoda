import { getDb } from "../schema";
import { decryptRow, decryptRows, encryptForRow } from "./index";

export interface ProgressRecord {
  id: string;
  student_id: string;
  teacher_id: string | null;
  surah_number: number;
  surah_name: string;
  juz_number: number;
  from_page: number | null;
  to_page: number | null;
  note: string;
  recorded_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function upsertProgress(p: ProgressRecord): Promise<void> {
  const encrypted = await encryptForRow(p, {
    id: p.id,
    updated_at: p.updated_at ?? "",
    student_id: p.student_id,
    recorded_at: p.recorded_at ?? "",
  });
  await getDb().progress.put(encrypted);
}

export async function upsertProgressBulk(rows: ProgressRecord[]): Promise<void> {
  const encrypted = await Promise.all(
    rows.map((p) =>
      encryptForRow(p, {
        id: p.id,
        updated_at: p.updated_at ?? "",
        student_id: p.student_id,
        recorded_at: p.recorded_at ?? "",
      })
    )
  );
  await getDb().progress.bulkPut(encrypted);
}

export async function getProgress(id: string): Promise<ProgressRecord | undefined> {
  const row = await getDb().progress.get(id);
  if (!row) return undefined;
  return decryptRow<ProgressRecord>(row);
}

export async function listProgressForStudent(
  studentId: string
): Promise<ProgressRecord[]> {
  const db = getDb();
  const rows = await db.progress
    .where("student_id")
    .equals(studentId)
    .reverse()
    .sortBy("recorded_at");
  return decryptRows<ProgressRecord>(rows);
}

export async function deleteProgressLocal(id: string): Promise<void> {
  await getDb().progress.delete(id);
}
