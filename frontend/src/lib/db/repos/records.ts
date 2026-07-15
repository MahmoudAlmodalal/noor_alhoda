import { getDb } from "../schema";
import { decryptRows, encryptForRow } from "./index";

export interface WeeklyPlanRecord {
  id: string;
  student_id: string;
  week_number: number;
  week_start: string;
  total_required: number;
  total_achieved: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface DailyRecordRecord {
  id: string;
  weekly_plan_id: string;
  day: "sat" | "sun" | "mon" | "tue" | "wed" | "thu";
  date: string;
  attendance: "present" | "absent" | "late" | "excused";
  required_verses: number;
  achieved_verses: number;
  surah_name: string;
  quality: "excellent" | "good" | "acceptable" | "weak" | "none";
  note: string;
  result: "pass" | "fail" | "pending";
  recorded_by_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  review_surah_name?: string;
  review_from_ayah?: number | null;
  review_to_ayah?: number | null;
  review_quality?: "excellent" | "good" | "acceptable" | "weak" | "none";
}

export interface ReviewRecordRecord {
  id: string;
  student_id: string;
  surah_name: string;
  reviewed_date: string;
  quality: string;
  note: string;
  recorded_by_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// Weekly plans
// ---------------------------------------------------------------------------

export async function upsertWeeklyPlans(plans: WeeklyPlanRecord[]): Promise<void> {
  const encrypted = await Promise.all(
    plans.map((p) =>
      encryptForRow(p, {
        id: p.id,
        updated_at: p.updated_at ?? p.created_at ?? "",
        student_id: p.student_id,
        week_start: p.week_start,
      })
    )
  );
  await getDb().weekly_plans.bulkPut(encrypted);
}

export async function listWeeklyPlans(params?: {
  student_id?: string;
}): Promise<WeeklyPlanRecord[]> {
  const db = getDb();
  const rows = params?.student_id
    ? await db.weekly_plans.where("student_id").equals(params.student_id).toArray()
    : await db.weekly_plans.toArray();
  const decrypted = await decryptRows<WeeklyPlanRecord>(rows);
  decrypted.sort((a, b) => (a.week_start < b.week_start ? 1 : -1));
  return decrypted;
}

export async function getWeeklyPlanForWeek(
  student_id: string,
  week_start: string
): Promise<WeeklyPlanRecord | undefined> {
  const rows = await getDb()
    .weekly_plans.where("student_id")
    .equals(student_id)
    .toArray();
  const decrypted = await decryptRows<WeeklyPlanRecord>(rows);
  return decrypted.find((p) => p.week_start === week_start);
}

// ---------------------------------------------------------------------------
// Daily records
// ---------------------------------------------------------------------------

export async function upsertDailyRecords(
  records: DailyRecordRecord[]
): Promise<void> {
  const encrypted = await Promise.all(
    records.map((r) =>
      encryptForRow(r, {
        id: r.id,
        updated_at: r.updated_at ?? r.created_at ?? "",
        weekly_plan_id: r.weekly_plan_id,
        date: r.date,
        day: r.day,
      })
    )
  );
  await getDb().daily_records.bulkPut(encrypted);
}

export async function listDailyRecordsByPlan(
  weekly_plan_id: string
): Promise<DailyRecordRecord[]> {
  const rows = await getDb()
    .daily_records.where("weekly_plan_id")
    .equals(weekly_plan_id)
    .toArray();
  return decryptRows<DailyRecordRecord>(rows);
}

export async function listDailyRecordsInRange(
  from: string,
  to: string
): Promise<DailyRecordRecord[]> {
  const rows = await getDb()
    .daily_records.where("date")
    .between(from, to, true, true)
    .toArray();
  return decryptRows<DailyRecordRecord>(rows);
}

export async function listDailyRecordsForDate(
  date: string
): Promise<DailyRecordRecord[]> {
  const rows = await getDb().daily_records.where("date").equals(date).toArray();
  return decryptRows<DailyRecordRecord>(rows);
}

// ---------------------------------------------------------------------------
// Review records
// ---------------------------------------------------------------------------

export async function upsertReviewRecords(
  records: ReviewRecordRecord[]
): Promise<void> {
  const encrypted = await Promise.all(
    records.map((r) =>
      encryptForRow(r, {
        id: r.id,
        updated_at: r.updated_at ?? r.created_at ?? "",
        student_id: r.student_id,
        reviewed_date: r.reviewed_date,
      })
    )
  );
  await getDb().review_records.bulkPut(encrypted);
}

export async function listReviewRecordsForStudent(
  student_id: string
): Promise<ReviewRecordRecord[]> {
  const rows = await getDb()
    .review_records.where("student_id")
    .equals(student_id)
    .toArray();
  const decrypted = await decryptRows<ReviewRecordRecord>(rows);
  decrypted.sort((a, b) => (a.reviewed_date < b.reviewed_date ? 1 : -1));
  return decrypted;
}

// ---------------------------------------------------------------------------
// Delete-by-id (used by tombstone consumer)
// ---------------------------------------------------------------------------

export async function deleteWeeklyPlanLocal(id: string): Promise<void> {
  await getDb().weekly_plans.delete(id);
}
export async function deleteDailyRecordLocal(id: string): Promise<void> {
  await getDb().daily_records.delete(id);
}
export async function deleteReviewRecordLocal(id: string): Promise<void> {
  await getDb().review_records.delete(id);
}
