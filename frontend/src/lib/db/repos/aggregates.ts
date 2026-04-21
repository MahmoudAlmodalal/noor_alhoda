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

import { listCourses, listEvaluationsForStudent, listTeachers } from "./misc";
import {
  listDailyRecordsForDate,
  listDailyRecordsInRange,
  listReviewRecordsForStudent,
  listWeeklyPlans,
  type DailyRecordRecord,
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
      return {
        surah_name,
        last_memorized_date: v.last_memorized,
        last_review_date: v.last_review,
        days_since_review: daysSince,
      };
    })
    .filter((t) => t.days_since_review >= reviewIntervalDays)
    .sort((a, b) => b.days_since_review - a.days_since_review);

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

  return {
    week_start: ws,
    total_required: plan.total_required,
    total_achieved: plan.total_achieved,
    completion_rate: completionRate(plan.total_achieved, plan.total_required),
    records,
  };
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
}): Promise<PlanForList[]> {
  const [plans, students] = await Promise.all([
    listWeeklyPlans(filters?.student_id ? { student_id: filters.student_id } : undefined),
    listStudents(),
  ]);
  const sById = new Map(students.map((s) => [s.id, s]));
  const filtered = filters?.week_start
    ? plans.filter((p) => p.week_start === filters.week_start)
    : plans;
  return filtered.map((p) => {
    const s = sById.get(p.student_id);
    return {
      ...p,
      student_name: s?.full_name ?? "",
      completion_rate: completionRate(p.total_achieved, p.total_required),
      review_interval_days: s?.review_interval_days ?? 14,
    };
  });
}
