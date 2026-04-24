/**
 * Local computations for server-derived views (dashboard stats, student
 * stats, today-tasks, weekly summary, attendance report, leaderboard,
 * student history, student-courses join).
 *
 * Aggregates are computed from the cached primitives (students, plans,
 * daily/review records, evaluations) — they are intentionally simpler
 * than the server's selectors. They cover what the UI renders today;
 * gamification fields (points, streak, levels) use simple heuristics.
 *
 * When offline, this is the only source of truth. When online, the next
 * pull updates the underlying primitives and these functions recompute.
 */
import type {
  AttendanceReport,
  DashboardStats,
  HistoryEntry,
  LeaderboardEntry,
  StudentCourseStatus,
  StudentStats,
  TodayTasks,
  WeeklySummary,
} from "@/types/api";

import {
  listCourses,
  listEvaluationsForStudent,
  listTeachers,
  type EvaluationRecord,
} from "./misc";
import {
  listDailyRecordsForDate,
  listDailyRecordsInRange,
  listReviewRecordsForStudent,
  listWeeklyPlans,
  type DailyRecordRecord,
  type ReviewRecordRecord,
  type WeeklyPlanRecord,
} from "./records";
import { getStudent, listStudents } from "./students";
import { getDb } from "../schema";
import { decryptRows } from "./index";
import type { StudentCourseRecord } from "./misc";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekdayKey(d: Date): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
}

/** Saturday on or before the given date (Sat–Thu Quranic week). */
function weekStartFor(d: Date): string {
  const copy = new Date(d.getTime());
  // JS day: Sun=0..Sat=6. Saturday is 6. Step back to it.
  const diff = (copy.getDay() - 6 + 7) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy.toISOString().slice(0, 10);
}

function completionRate(achieved: number, required: number): number {
  if (!required) return 0;
  return Math.min(100, Math.round((achieved / required) * 100));
}

// ---------------------------------------------------------------------------
// Dashboard stats (admin) and teacher fallback
// ---------------------------------------------------------------------------

export async function dashboardStats(): Promise<DashboardStats> {
  const [students, teachers, todayRecords, plans] = await Promise.all([
    listStudents(),
    listTeachers(),
    listDailyRecordsForDate(todayIso()),
    listWeeklyPlans(),
  ]);

  const present = todayRecords.filter((r) => r.attendance === "present").length;
  const absent = todayRecords.filter((r) => r.attendance === "absent").length;
  const late = todayRecords.filter((r) => r.attendance === "late").length;

  const ws = weekStartFor(new Date());
  const thisWeek = plans.filter((p) => p.week_start === ws);
  const avg =
    thisWeek.length === 0
      ? 0
      : Math.round(
          thisWeek.reduce(
            (s, p) => s + completionRate(p.total_achieved, p.total_required),
            0
          ) / thisWeek.length
        );

  const outstanding = students.filter((s) => !s.teacher_id).length;

  return {
    total_students: students.length,
    total_teachers: teachers.length,
    today: {
      present,
      absent,
      total_recorded: todayRecords.length,
    },
    this_week: { avg_completion_rate: avg },
    outstanding_count: outstanding,
    outstanding,
    late,
  };
}

// ---------------------------------------------------------------------------
// Students overview (students list hero)
// ---------------------------------------------------------------------------

export interface StudentsOverviewStats {
  total: number;
  present_today: number;
  unassigned: number;
}

export async function studentsOverviewStats(): Promise<StudentsOverviewStats> {
  const [students, todayRecords, plans] = await Promise.all([
    listStudents(),
    listDailyRecordsForDate(todayIso()),
    listWeeklyPlans(),
  ]);

  const planToStudent = new Map<string, string>();
  for (const p of plans) planToStudent.set(p.id, p.student_id);

  const presentToday = new Set<string>();
  for (const r of todayRecords) {
    if (r.attendance === "present") {
      const sid = planToStudent.get(r.weekly_plan_id);
      if (sid) presentToday.add(sid);
    }
  }

  return {
    total: students.length,
    present_today: presentToday.size,
    unassigned: students.filter((s) => !s.teacher_id).length,
  };
}

// ---------------------------------------------------------------------------
// Student stats
// ---------------------------------------------------------------------------

const QUALITY_GRADE: Record<string, number> = {
  excellent: 100,
  good: 85,
  acceptable: 70,
  weak: 50,
  none: 0,
};

const LEVEL_BANDS: { min: number; label: string; goal: string }[] = [
  { min: 25, label: "متقن", goal: "إكمال حفظ القرآن الكريم" },
  { min: 15, label: "متقدم", goal: "إكمال 25 جزءًا" },
  { min: 10, label: "حافظ", goal: "إكمال 15 جزءًا" },
  { min: 5, label: "متابع", goal: "إكمال 10 أجزاء" },
  { min: 1, label: "مبتدئ", goal: "إكمال 5 أجزاء" },
  { min: 0, label: "جديد", goal: "بدء الحفظ" },
];

export async function studentStats(student_id: string): Promise<StudentStats> {
  const [student, plans, today] = await Promise.all([
    getStudent(student_id),
    listWeeklyPlans({ student_id }),
    listDailyRecordsForDate(todayIso()),
  ]);

  const planIds = new Set(plans.map((p) => p.id));
  const allDaily: DailyRecordRecord[] = [];
  for (const p of plans) {
    const rows = await getDb()
      .daily_records.where("weekly_plan_id")
      .equals(p.id)
      .toArray();
    const dec = await decryptRows<DailyRecordRecord>(rows);
    allDaily.push(...dec);
  }

  const totalDays = allDaily.length;
  const presentDays = allDaily.filter((r) => r.attendance === "present").length;
  const absentDays = allDaily.filter((r) => r.attendance === "absent").length;
  const totalRequired = allDaily.reduce((s, r) => s + (r.required_verses || 0), 0);
  const totalAchieved = allDaily.reduce((s, r) => s + (r.achieved_verses || 0), 0);
  const overallRate = completionRate(totalAchieved, totalRequired);
  const attendanceRate = totalDays === 0 ? 0 : Math.round((presentDays / totalDays) * 100);

  const qualityScores = allDaily
    .map((r) => QUALITY_GRADE[r.quality] ?? 0)
    .filter((n) => n > 0);
  const avgGradeNum =
    qualityScores.length === 0
      ? 0
      : Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length);
  const avgGrade = avgGradeNum >= 90 ? "ممتاز" : avgGradeNum >= 80 ? "جيد جدًا" : avgGradeNum >= 70 ? "جيد" : avgGradeNum >= 50 ? "مقبول" : "—";

  // Memorized parts: rough heuristic — every 600 verses ≈ 1 جزء.
  const memorizedParts = Math.floor(totalAchieved / 600);

  // Streak: consecutive recorded days (any day with achieved>0 or present)
  // ending at today, walking back. Cap at 365 to avoid runaway loops.
  const dailyByDate = new Map<string, DailyRecordRecord>();
  for (const r of allDaily) dailyByDate.set(r.date, r);
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10);
    const r = dailyByDate.get(key);
    if (r && (r.achieved_verses > 0 || r.attendance === "present")) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  const points = totalAchieved + presentDays * 5 + streak * 10;
  const band = LEVEL_BANDS.find((b) => memorizedParts >= b.min)!;
  const goalProgress = Math.min(100, Math.round((memorizedParts / 30) * 100));

  const todayRec = today.find((r) =>
    planIds.has(r.weekly_plan_id)
  );

  void totalDays;

  return {
    student_id,
    student_name: student?.full_name ?? "",
    attendance_rate: attendanceRate,
    total_days: totalDays,
    present_days: presentDays,
    total_present: presentDays,
    total_absent: absentDays,
    total_required_verses: totalRequired,
    total_achieved_verses: totalAchieved,
    overall_completion_rate: overallRate,
    overall_rate: `${overallRate}%`,
    avg_grade: avgGrade,
    memorized_parts: memorizedParts,
    streak,
    points,
    memorization_level: band.label,
    current_goal: band.goal,
    goal_progress: goalProgress,
    today_record: todayRec
      ? {
          attendance: todayRec.attendance,
          quality: todayRec.quality,
          result: todayRec.result,
          surah_name: todayRec.surah_name,
          achieved_verses: todayRec.achieved_verses,
          required_verses: todayRec.required_verses,
        }
      : null,
    memorized_ajza: memorizedParts,
    review_count: 0,
    longest_streak: streak,
  };
}

// ---------------------------------------------------------------------------
// Today's tasks for a student
// ---------------------------------------------------------------------------

const DAY_LABEL: Record<string, string> = {
  sat: "السبت",
  sun: "الأحد",
  mon: "الاثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
  fri: "الجمعة",
};

export async function tasksToday(student_id: string): Promise<TodayTasks> {
  const today = todayIso();
  const todayDate = new Date();
  const dayKey = weekdayKey(todayDate);
  const isRest = dayKey === "fri";

  const [student, todayRecords, reviews, evals, plans] = await Promise.all([
    getStudent(student_id),
    listDailyRecordsForDate(today),
    listReviewRecordsForStudent(student_id),
    listEvaluationsForStudent(student_id),
    listWeeklyPlans({ student_id }),
  ]);

  const planIds = new Set(plans.map((p) => p.id));
  const myToday = todayRecords.find((r) => planIds.has(r.weekly_plan_id));

  const reviewIntervalDays = student?.review_interval_days ?? 14;

  const surahLast = new Map<string, { last_memorized: string; last_review: string | null }>();
  // Last memorized = max date in daily_records where achieved_verses>0
  for (const p of plans) {
    const rows = await getDb()
      .daily_records.where("weekly_plan_id")
      .equals(p.id)
      .toArray();
    const dec = await decryptRows<DailyRecordRecord>(rows);
    for (const r of dec) {
      if (!r.surah_name || r.achieved_verses <= 0) continue;
      const cur = surahLast.get(r.surah_name);
      if (!cur || cur.last_memorized < r.date) {
        surahLast.set(r.surah_name, {
          last_memorized: r.date,
          last_review: cur?.last_review ?? null,
        });
      }
    }
  }
  for (const r of reviews) {
    const cur = surahLast.get(r.surah_name);
    if (!cur) continue;
    if (!cur.last_review || cur.last_review < r.reviewed_date) {
      cur.last_review = r.reviewed_date;
    }
  }

  const reviewTasks = Array.from(surahLast.entries())
    .map(([surah_name, v]) => {
      const ref = v.last_review ?? v.last_memorized;
      const daysSince = Math.floor(
        (todayDate.getTime() - new Date(ref).getTime()) / 86_400_000
      );
      // Offline approximation of the adaptive schedule: without the
      // SurahMastery table locally, we use the student's base interval.
      // The server's pool (via push/pull) is authoritative.
      const refDate = new Date(ref);
      const nextDue = new Date(refDate);
      nextDue.setDate(nextDue.getDate() + reviewIntervalDays);
      const overdue = Math.max(
        0,
        Math.floor(
          (todayDate.getTime() - nextDue.getTime()) / 86_400_000
        )
      );
      return {
        surah_name,
        last_memorized_date: v.last_memorized,
        last_review_date: v.last_review,
        days_since_review: daysSince,
        next_due_date: nextDue.toISOString().slice(0, 10),
        overdue_days: overdue,
      };
    })
    .filter((t) => t.days_since_review >= reviewIntervalDays)
    .sort((a, b) => b.overdue_days - a.overdue_days);

  const upcoming = evals
    .filter((e) => e.scheduled_date >= today && e.status === "scheduled")
    .map((e) => ({
      id: e.id,
      title: e.title,
      surah_range: e.surah_range,
      scheduled_date: e.scheduled_date,
      status: e.status as "scheduled" | "passed" | "failed" | "missed",
    }));

  const ws = weekStartFor(todayDate);
  const thisWeekPlan = plans.find((p) => p.week_start === ws);
  const weekly = thisWeekPlan
    ? {
        total_required: thisWeekPlan.total_required,
        total_achieved: thisWeekPlan.total_achieved,
        completion_rate: completionRate(
          thisWeekPlan.total_achieved,
          thisWeekPlan.total_required
        ),
        week_start: thisWeekPlan.week_start,
      }
    : { total_required: 0, total_achieved: 0, completion_rate: 0, week_start: ws };

  return {
    student_id,
    student_name: student?.full_name ?? "",
    today,
    is_rest_day: isRest,
    memorization: isRest
      ? null
      : myToday
        ? {
            day_label: DAY_LABEL[dayKey] ?? "",
            surah_name: myToday.surah_name,
            required_verses: myToday.required_verses,
            achieved_verses: myToday.achieved_verses,
            quality: myToday.quality,
            attendance: myToday.attendance,
            status:
              myToday.result === "pass"
                ? "done"
                : myToday.achieved_verses > 0
                  ? "in_progress"
                  : "pending",
            note: myToday.note,
          }
        : {
            day_label: DAY_LABEL[dayKey] ?? "",
            surah_name: "",
            required_verses: 0,
            achieved_verses: 0,
            quality: "none",
            attendance: "upcoming",
            status: "pending",
            note: "",
          },
    reviews: reviewTasks,
    upcoming_tests: upcoming,
    weekly_progress: weekly,
    review_interval_days: reviewIntervalDays,
  };
}

// ---------------------------------------------------------------------------
// Weekly summary
// ---------------------------------------------------------------------------

export async function weeklySummary(
  student_id: string,
  week_start_iso: string
): Promise<WeeklySummary> {
  const ws = weekStartFor(new Date(week_start_iso));
  const plans = await listWeeklyPlans({ student_id });
  const plan = plans.find((p) => p.week_start === ws);

  if (!plan) {
    return {
      week_start: ws,
      total_required: 0,
      total_achieved: 0,
      completion_rate: 0,
      records: [],
    };
  }

  const rows = await getDb()
    .daily_records.where("weekly_plan_id")
    .equals(plan.id)
    .toArray();
  const daily = await decryptRows<DailyRecordRecord>(rows);
  daily.sort((a, b) => (a.date < b.date ? -1 : 1));

  const records: HistoryEntry[] = daily.map((r) => ({
    id: r.id,
    date: r.date,
    day: r.day,
    attendance: r.attendance,
    surah_name: r.surah_name,
    required_verses: r.required_verses,
    achieved_verses: r.achieved_verses,
    quality: r.quality,
    note: r.note,
  }));

  const catchup = computeCatchup(daily);

  return {
    week_start: ws,
    week_number: plan.week_number,
    total_required: plan.total_required,
    total_achieved: plan.total_achieved,
    completion_rate: completionRate(plan.total_achieved, plan.total_required),
    records,
    catchup,
  };
}

/**
 * Derive a non-mutating catch-up suggestion from the current week's daily
 * records. Deficit = sum of (required - achieved) on past days where the
 * student missed/partially achieved. Redistribution is proportional to each
 * remaining day's required_verses — advisory only, never writes.
 */
function computeCatchup(daily: DailyRecordRecord[]): {
  deficit: number;
  suggested_per_day: { day: string; date: string; topup: number }[];
  weak_surahs: { surah_name: string; quality: string }[];
} | null {
  const DAY_LABELS: Record<string, string> = {
    sat: "السبت",
    sun: "الأحد",
    mon: "الاثنين",
    tue: "الثلاثاء",
    wed: "الأربعاء",
    thu: "الخميس",
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let deficit = 0;
  const weakSurahs: { surah_name: string; quality: string }[] = [];
  const seenWeak = new Set<string>();

  for (const r of daily) {
    const dayDate = new Date(r.date);
    dayDate.setHours(0, 0, 0, 0);
    if (dayDate >= today) continue;
    if (!r.required_verses) continue;
    const shortfall = Math.max(0, r.required_verses - r.achieved_verses);
    if (shortfall > 0) deficit += shortfall;
    if (
      (r.quality === "weak" || r.quality === "none") &&
      r.surah_name &&
      !seenWeak.has(r.surah_name)
    ) {
      seenWeak.add(r.surah_name);
      weakSurahs.push({ surah_name: r.surah_name, quality: r.quality });
    }
  }

  if (deficit === 0) return null;

  const remaining = daily
    .filter((r) => {
      const d = new Date(r.date);
      d.setHours(0, 0, 0, 0);
      return d >= today && r.required_verses > 0;
    })
    .map((r) => ({ day: r.day, date: r.date, required: r.required_verses }));

  if (remaining.length === 0) {
    return { deficit, suggested_per_day: [], weak_surahs: weakSurahs };
  }

  const totalRemainingRequired = remaining.reduce(
    (sum, r) => sum + r.required,
    0,
  );

  const suggested: { day: string; date: string; topup: number }[] = [];
  let distributed = 0;
  remaining.forEach((r, i) => {
    const topup =
      i === remaining.length - 1
        ? deficit - distributed
        : Math.round(
              (deficit * r.required) / Math.max(1, totalRemainingRequired),
          );
    distributed += topup;
    suggested.push({
      day: DAY_LABELS[r.day] ?? r.day,
      date: r.date,
      topup: Math.max(0, topup),
    });
  });

  return { deficit, suggested_per_day: suggested, weak_surahs: weakSurahs };
}

// ---------------------------------------------------------------------------
// Student history (weekly rollups)
// ---------------------------------------------------------------------------

export async function studentHistory(
  student_id: string
): Promise<HistoryEntry[]> {
  const plans = await listWeeklyPlans({ student_id });
  return plans.map((p) => ({
    id: p.id,
    date: p.week_start,
    attendance: "present",
    required_verses: p.total_required,
    achieved_verses: p.total_achieved,
    quality:
      p.total_required > 0 && p.total_achieved / p.total_required >= 0.85
        ? "excellent"
        : p.total_required > 0 && p.total_achieved / p.total_required >= 0.7
          ? "good"
          : "acceptable",
  }));
}

// ---------------------------------------------------------------------------
// Attendance report
// ---------------------------------------------------------------------------

export async function attendanceReport(params: {
  from?: string;
  to?: string;
  teacher_id?: string;
}): Promise<AttendanceReport> {
  const today = new Date();
  const monthFrom =
    params.from ?? new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthTo = params.to ?? today.toISOString().slice(0, 10);

  const [students, daily] = await Promise.all([
    listStudents(params.teacher_id ? { teacher_id: params.teacher_id } : undefined),
    listDailyRecordsInRange(monthFrom, monthTo),
  ]);

  const planIds = new Set<string>();
  const planToStudent = new Map<string, string>();
  // Collect all weekly_plan ids for the visible students.
  for (const s of students) {
    const plans = await listWeeklyPlans({ student_id: s.id });
    for (const p of plans) {
      planIds.add(p.id);
      planToStudent.set(p.id, s.id);
    }
  }

  const inScope = daily.filter((r) => planIds.has(r.weekly_plan_id));

  const byStudent = new Map<
    string,
    { total: number; present: number; absent: number }
  >();
  for (const r of inScope) {
    const sid = planToStudent.get(r.weekly_plan_id);
    if (!sid) continue;
    const v = byStudent.get(sid) ?? { total: 0, present: 0, absent: 0 };
    v.total += 1;
    if (r.attendance === "present") v.present += 1;
    else if (r.attendance === "absent") v.absent += 1;
    byStudent.set(sid, v);
  }

  const rows = students.map((s) => {
    const v = byStudent.get(s.id) ?? { total: 0, present: 0, absent: 0 };
    return {
      student_id: s.id,
      student_name: s.full_name,
      total_days: v.total,
      present_days: v.present,
      absent_days: v.absent,
      rate: v.total === 0 ? 0 : Math.round((v.present / v.total) * 100),
    };
  });

  const summary = {
    total_records: inScope.length,
    present: inScope.filter((r) => r.attendance === "present").length,
    absent: inScope.filter((r) => r.attendance === "absent").length,
    excused: inScope.filter((r) => r.attendance === "excused").length,
    attendance_rate:
      inScope.length === 0
        ? 0
        : Math.round(
            (inScope.filter((r) => r.attendance === "present").length /
              inScope.length) *
              100
          ),
  };

  return {
    month: today.getMonth() + 1,
    year: today.getFullYear(),
    teacher_id: params.teacher_id,
    students: rows,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export async function leaderboard(): Promise<LeaderboardEntry[]> {
  const [students, teachers] = await Promise.all([listStudents(), listTeachers()]);
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const ws = weekStartFor(new Date());

  const rows: LeaderboardEntry[] = [];
  for (const s of students) {
    const plans = await listWeeklyPlans({ student_id: s.id });
    const week = plans.find((p) => p.week_start === ws);
    if (!week) continue;
    const planRows = await getDb()
      .daily_records.where("weekly_plan_id")
      .equals(week.id)
      .toArray();
    const daily = await decryptRows<DailyRecordRecord>(planRows);
    const present = daily.filter((r) => r.attendance === "present").length;
    rows.push({
      rank: 0,
      student_id: s.id,
      student_name: s.full_name,
      total_achieved: week.total_achieved,
      total_required: week.total_required,
      present_days: present,
      ring_name: s.teacher_id ? teacherById.get(s.teacher_id)?.ring_name : undefined,
    });
  }

  rows.sort((a, b) => {
    if (b.total_achieved !== a.total_achieved) return b.total_achieved - a.total_achieved;
    return b.present_days - a.present_days;
  });
  rows.forEach((r, i) => (r.rank = i + 1));

  return rows;
}

// ---------------------------------------------------------------------------
// Student courses (join student_courses with courses)
// ---------------------------------------------------------------------------

export async function studentCoursesForStudent(
  student_id: string
): Promise<StudentCourseStatus[]> {
  const [scRows, courses] = await Promise.all([
    getDb()
      .student_courses.where("student_id")
      .equals(student_id)
      .toArray()
      .then((rows) => decryptRows<StudentCourseRecord>(rows)),
    listCourses(),
  ]);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  return scRows
    .map((sc) => {
      const c = courseById.get(sc.course_id);
      if (!c) return null;
      return {
        course_id: c.id,
        course_name: c.name,
        description: c.description,
        is_completed: sc.is_completed,
        completion_date: sc.completion_date,
      };
    })
    .filter((x): x is StudentCourseStatus => x !== null);
}

// ---------------------------------------------------------------------------
// Daily records enriched with student_name (via weekly_plan join)
// ---------------------------------------------------------------------------

export interface DailyRecordWithStudent extends DailyRecordRecord {
  student_id: string;
  student_name: string;
}

export async function listDailyRecordsWithStudentForDate(
  date: string,
  filters?: { teacher_id?: string }
): Promise<DailyRecordWithStudent[]> {
  const [records, plans, students] = await Promise.all([
    listDailyRecordsForDate(date),
    listWeeklyPlans(),
    listStudents(filters?.teacher_id ? { teacher_id: filters.teacher_id } : undefined),
  ]);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const planToStudent = new Map(plans.map((p) => [p.id, p.student_id]));
  return records
    .map((r) => {
      const sid = planToStudent.get(r.weekly_plan_id);
      if (!sid) return null;
      const s = studentById.get(sid);
      if (!s) return null;
      return { ...r, student_id: sid, student_name: s.full_name };
    })
    .filter((r): r is DailyRecordWithStudent => r !== null);
}

// ---------------------------------------------------------------------------
// Plans listing for the /plans page (joined with student name)
// ---------------------------------------------------------------------------

export interface PlanForList extends WeeklyPlanRecord {
  student_name: string;
  completion_rate: number;
  review_interval_days: number;
}

export async function listPlansForUI(filters?: {
  student_id?: string;
  week_start?: string;
  teacher_id?: string;
}): Promise<PlanForList[]> {
  const [plans, students] = await Promise.all([
    listWeeklyPlans(filters?.student_id ? { student_id: filters.student_id } : undefined),
    listStudents(filters?.teacher_id ? { teacher_id: filters.teacher_id } : undefined),
  ]);
  const sById = new Map(students.map((s) => [s.id, s]));
  const scopedPlans = filters?.teacher_id
    ? plans.filter((p) => sById.has(p.student_id))
    : plans;
  const filtered = filters?.week_start
    ? scopedPlans.filter((p) => p.week_start === filters.week_start)
    : scopedPlans;
  return filtered
    .map((p) => {
      const s = sById.get(p.student_id);
      if (!s && filters?.teacher_id) return null;
      return {
        ...p,
        student_name: s?.full_name ?? "",
        completion_rate: completionRate(p.total_achieved, p.total_required),
        review_interval_days: s?.review_interval_days ?? 14,
      };
    })
    .filter((p): p is PlanForList => p !== null);
}

// ---------------------------------------------------------------------------
// Teacher dashboard aggregates
// ---------------------------------------------------------------------------

export interface TeacherAggregateStats {
  avgWeeklyCompletion: number;
  avgQuality: string;
  totalVersesThisWeek: number;
  pendingReviews: number;
  upcomingEvaluations: number;
}

export async function teacherAggregateStats(
  teacher_id: string
): Promise<TeacherAggregateStats> {
  const students = await listStudents({ teacher_id });
  if (students.length === 0) {
    return {
      avgWeeklyCompletion: 0,
      avgQuality: "—",
      totalVersesThisWeek: 0,
      pendingReviews: 0,
      upcomingEvaluations: 0,
    };
  }

  const studentIds = new Set(students.map((s) => s.id));
  const todayDate = new Date();
  const ws = weekStartFor(todayDate);
  const weekEnd = new Date(ws);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);
  const todayStr = todayIso();
  const in14 = new Date(todayDate);
  in14.setDate(in14.getDate() + 14);
  const in14Iso = in14.toISOString().slice(0, 10);

  const allPlans = await listWeeklyPlans();
  const teacherPlans = allPlans.filter((p) => studentIds.has(p.student_id));
  const thisWeekPlans = teacherPlans.filter((p) => p.week_start === ws);

  const avgWeeklyCompletion =
    thisWeekPlans.length === 0
      ? 0
      : Math.round(
          thisWeekPlans.reduce(
            (s, p) => s + completionRate(p.total_achieved, p.total_required),
            0
          ) / thisWeekPlans.length
        );

  const totalVersesThisWeek = thisWeekPlans.reduce(
    (s, p) => s + (p.total_achieved || 0),
    0
  );

  // Average quality from this week's daily records (teacher-scoped)
  const planIdsThisWeek = new Set(thisWeekPlans.map((p) => p.id));
  let avgQuality = "—";
  if (planIdsThisWeek.size > 0) {
    const weekDaily = await listDailyRecordsInRange(ws, weekEndIso);
    const teacherDaily = weekDaily.filter((r) =>
      planIdsThisWeek.has(r.weekly_plan_id)
    );
    const qualityScores = teacherDaily
      .map((r) => QUALITY_GRADE[r.quality] ?? 0)
      .filter((n) => n > 0);
    if (qualityScores.length > 0) {
      const avg =
        qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
      avgQuality =
        avg >= 90
          ? "ممتاز"
          : avg >= 80
            ? "جيد جدًا"
            : avg >= 70
              ? "جيد"
              : avg >= 50
                ? "مقبول"
                : "ضعيف";
    }
  }

  // Upcoming evaluations within 14 days (scheduled) + pending reviews,
  // parallelized across students to avoid N-round-trip latency on first load.
  const [evalCounts, reviewCounts] = await Promise.all([
    Promise.all(
      students.map(async (s) => {
        const evs = await listEvaluationsForStudent(s.id);
        return evs.filter(
          (e) =>
            e.status === "scheduled" &&
            e.scheduled_date >= todayStr &&
            e.scheduled_date <= in14Iso
        ).length;
      })
    ),
    Promise.all(
      students.map((s) => computeDueReviewsForStudent(s.id).then((r) => r.length))
    ),
  ]);
  const upcomingEvaluations = evalCounts.reduce((a, b) => a + b, 0);
  const pendingReviews = reviewCounts.reduce((a, b) => a + b, 0);

  return {
    avgWeeklyCompletion,
    avgQuality,
    totalVersesThisWeek,
    pendingReviews,
    upcomingEvaluations,
  };
}

export interface EvaluationForTeacher extends EvaluationRecord {
  student_name: string;
}

export async function listEvaluationsForTeacher(
  teacher_id: string
): Promise<EvaluationForTeacher[]> {
  const students = await listStudents({ teacher_id });
  const perStudent = await Promise.all(
    students.map(async (s) => {
      const evs = await listEvaluationsForStudent(s.id);
      return evs.map((e) => ({ ...e, student_name: s.full_name }));
    })
  );
  return perStudent
    .flat()
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
}

export interface DueReviewRow {
  student_id: string;
  student_name: string;
  surah_name: string;
  last_memorized: string;
  last_reviewed: string | null;
  days_since_review: number;
  review_interval_days: number;
}

export interface ReviewHistoryRow extends ReviewRecordRecord {
  student_name: string;
}

export interface ReviewsForTeacher {
  due: DueReviewRow[];
  history: ReviewHistoryRow[];
}

async function computeDueReviewsForStudent(
  student_id: string
): Promise<Omit<DueReviewRow, "student_name">[]> {
  const [student, plans, reviews] = await Promise.all([
    getStudent(student_id),
    listWeeklyPlans({ student_id }),
    listReviewRecordsForStudent(student_id),
  ]);
  const reviewIntervalDays = student?.review_interval_days ?? 14;

  const surahLast = new Map<
    string,
    { last_memorized: string; last_reviewed: string | null }
  >();

  for (const p of plans) {
    const rows = await getDb()
      .daily_records.where("weekly_plan_id")
      .equals(p.id)
      .toArray();
    const dec = await decryptRows<DailyRecordRecord>(rows);
    for (const r of dec) {
      if (!r.surah_name || r.achieved_verses <= 0) continue;
      const cur = surahLast.get(r.surah_name);
      if (!cur || cur.last_memorized < r.date) {
        surahLast.set(r.surah_name, {
          last_memorized: r.date,
          last_reviewed: cur?.last_reviewed ?? null,
        });
      }
    }
  }

  for (const r of reviews) {
    const cur = surahLast.get(r.surah_name);
    if (!cur) continue;
    if (!cur.last_reviewed || cur.last_reviewed < r.reviewed_date) {
      cur.last_reviewed = r.reviewed_date;
    }
  }

  const now = new Date();
  return Array.from(surahLast.entries())
    .map(([surah_name, v]) => {
      const ref = v.last_reviewed ?? v.last_memorized;
      const daysSince = Math.floor(
        (now.getTime() - new Date(ref).getTime()) / 86_400_000
      );
      return {
        student_id,
        surah_name,
        last_memorized: v.last_memorized,
        last_reviewed: v.last_reviewed,
        days_since_review: daysSince,
        review_interval_days: reviewIntervalDays,
      };
    })
    .filter((t) => t.days_since_review >= reviewIntervalDays);
}

export async function listReviewsForTeacher(
  teacher_id: string
): Promise<ReviewsForTeacher> {
  const students = await listStudents({ teacher_id });

  const perStudent = await Promise.all(
    students.map(async (s) => {
      const [dueRows, reviews] = await Promise.all([
        computeDueReviewsForStudent(s.id),
        listReviewRecordsForStudent(s.id),
      ]);
      return {
        due: dueRows.map((r) => ({ ...r, student_name: s.full_name })),
        history: reviews.map((r) => ({ ...r, student_name: s.full_name })),
      };
    })
  );

  const due = perStudent.flatMap((p) => p.due);
  const history = perStudent.flatMap((p) => p.history);

  due.sort((a, b) => b.days_since_review - a.days_since_review);
  history.sort((a, b) => b.reviewed_date.localeCompare(a.reviewed_date));

  return { due, history: history.slice(0, 50) };
}
