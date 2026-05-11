/**
 * Query dispatcher: maps a (resource, params) call to the corresponding
 * local repo function and lists the change-bus events that should
 * trigger a refetch.
 *
 * Pages do not import repos directly — they call useQuery(key, params),
 * which goes through this table. This keeps the hook dumb and centralises
 * the offline read surface.
 */
import { type ResourceName } from "@/lib/db/events";
import {
  attendanceReport,
  dashboardStats,
  leaderboard,
  listDailyRecordsWithStudentForDate,
  listEvaluationsForTeacher,
  listPlansForUI,
  listReviewsForTeacher,
  studentCoursesForStudent,
  studentHistory,
  studentStats,
  studentsOverviewStats,
  tasksToday,
  teacherAggregateStats,
  weeklySummary,
} from "@/lib/db/repos/aggregates";
import {
  listCourses,
  listEvaluationsForStudent,
  listNotificationsForUser,
  listTeachers,
  listUsers,
  type CourseRecord,
  type EvaluationRecord,
  type NotificationRecord,
  type TeacherRecord,
  type UserRecord,
} from "@/lib/db/repos/misc";
import {
  getWeeklyPlanForWeek,
  listDailyRecordsByPlan,
  listDailyRecordsForDate,
  listDailyRecordsInRange,
  listReviewRecordsForStudent,
  listWeeklyPlans,
  type DailyRecordRecord,
  type ReviewRecordRecord,
  type WeeklyPlanRecord,
} from "@/lib/db/repos/records";

function todayIsoString(): string {
  return new Date().toISOString().slice(0, 10);
}
import { getStudent, listStudents, type StudentRecord } from "@/lib/db/repos/students";
import { listProgressForStudent, type ProgressRecord } from "@/lib/db/repos/progress";

export type QueryParams = Record<string, string | number | boolean | undefined>;

export type QueryKey =
  | "students"
  | "student"
  | "students_with_teacher"
  | "students_overview_stats"
  | "teachers"
  | "courses"
  | "weekly_plans"
  | "weekly_plan_for_week"
  | "plans_for_ui"
  | "daily_records"
  | "daily_records_with_student"
  | "review_records"
  | "evaluations"
  | "notifications"
  | "student_courses"
  | "dashboard_stats"
  | "student_stats"
  | "tasks_today"
  | "student_history"
  | "weekly_summary"
  | "attendance_report"
  | "leaderboard"
  | "teacher_aggregate_stats"
  | "evaluations_for_teacher"
  | "reviews_for_teacher"
  | "progress";

export interface QueryDef<TParams = QueryParams, TResult = unknown> {
  fn: (params: TParams) => Promise<TResult>;
  /** ResourceName events that should trigger a refetch when emitted. */
  depends: ResourceName[];
}

/**
 * Enriches StudentRecord with teacher_name and is_active so list pages
 * don't have to do the join. Mirrors the server's student serializer.
 */
export interface StudentWithTeacher extends StudentRecord {
  teacher_name: string | null;
  is_active: boolean;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_account_type: string | null;
  affiliation: string;
  today_attendance_status: "present" | "absent" | "late" | "excused" | null;
  memorized_ajza_count: number;
}

export interface TeacherWithUser extends TeacherRecord {
  national_id: string;
  phone_number: string;
}

async function listTeachersWithUser(): Promise<TeacherWithUser[]> {
  const [teachers, users] = await Promise.all([listTeachers(), listUsers()]);
  const userById = new Map(users.map((u) => [u.id, u]));
  return teachers.map((t) => {
    const u = userById.get(t.user_id);
    return {
      ...t,
      national_id: u?.national_id ?? "",
      phone_number: u?.phone_number ?? "",
    };
  });
}

async function listStudentsWithTeacher(
  params: QueryParams = {}
): Promise<StudentWithTeacher[]> {
  const filter: { teacher_id?: string; search?: string } = {};
  if (typeof params.teacher_id === "string") filter.teacher_id = params.teacher_id;
  if (typeof params.search === "string") filter.search = params.search;

  const [students, teachers, allPlans, todayRecords] = await Promise.all([
    listStudents(filter),
    listTeachers(),
    listWeeklyPlans(),
    listDailyRecordsForDate(todayIsoString()),
  ]);

  let filtered = students;

  if (typeof params.grade === "string" && params.grade) {
    filtered = filtered.filter((s) => s.grade === params.grade);
  }

  if (typeof params.course_id === "string" && params.course_id) {
    // student_id is a cleartext indexed column on the encrypted student_courses
    // table, so we can filter without decrypting.
    const { getDb } = await import("@/lib/db/schema");
    const scRows = await getDb()
      .student_courses.where("course_id")
      .equals(params.course_id)
      .toArray();
    const allowed = new Set(scRows.map((r) => r.student_id));
    filtered = filtered.filter((s) => allowed.has(s.id));
  }

  const teacherById = new Map(teachers.map((t) => [t.id, t.full_name]));

  const planToStudent = new Map<string, string>();
  for (const p of allPlans) planToStudent.set(p.id, p.student_id);

  const todayByStudent = new Map<
    string,
    StudentWithTeacher["today_attendance_status"]
  >();
  for (const r of todayRecords) {
    const sid = planToStudent.get(r.weekly_plan_id);
    if (!sid) continue;
    const a = r.attendance;
    if (a === "present" || a === "absent" || a === "late" || a === "excused") {
      todayByStudent.set(sid, a);
    }
  }

  const achievedByStudent = new Map<string, number>();
  for (const p of allPlans) {
    achievedByStudent.set(
      p.student_id,
      (achievedByStudent.get(p.student_id) ?? 0) + (p.total_achieved || 0)
    );
  }

  return filtered.map((s) => ({
    ...s,
    teacher_name: s.teacher_id ? teacherById.get(s.teacher_id) ?? null : null,
    is_active: true,
    bank_account_number: null,
    bank_account_name: null,
    bank_account_type: null,
    affiliation: "",
    today_attendance_status: todayByStudent.get(s.id) ?? null,
    memorized_ajza_count: Math.floor((achievedByStudent.get(s.id) ?? 0) / 600),
  }));
}

const QUERIES: Record<QueryKey, QueryDef> = {
  students: {
    fn: (p) =>
      listStudents({
        teacher_id: typeof p?.teacher_id === "string" ? p.teacher_id : undefined,
        search: typeof p?.search === "string" ? p.search : undefined,
      }),
    depends: ["student"],
  },
  students_with_teacher: {
    fn: (p) => listStudentsWithTeacher(p),
    depends: ["student", "teacher", "daily_record", "weekly_plan"],
  },
  students_overview_stats: {
    fn: () => studentsOverviewStats(),
    depends: ["student", "daily_record", "weekly_plan"],
  },
  student: {
    fn: async (p) => {
      const id = typeof p?.id === "string" ? p.id : "";
      if (!id) return undefined;
      const [s, teachers] = await Promise.all([getStudent(id), listTeachers()]);
      if (!s) return undefined;
      const teacher = teachers.find((t) => t.id === s.teacher_id);
      const enriched: StudentWithTeacher = {
        ...s,
        teacher_name: teacher?.full_name ?? null,
        is_active: true,
        bank_account_number: null,
        bank_account_name: null,
        bank_account_type: null,
        affiliation: "",
        today_attendance_status: null,
        memorized_ajza_count: 0,
      };
      return enriched;
    },
    depends: ["student", "teacher"],
  },
  teachers: {
    fn: () => listTeachersWithUser(),
    depends: ["teacher"],
  },
  courses: {
    fn: () => listCourses(),
    depends: ["course"],
  },
  weekly_plans: {
    fn: (p) =>
      listWeeklyPlans({
        student_id:
          typeof p?.student_id === "string" ? p.student_id : undefined,
      }),
    depends: ["weekly_plan", "daily_record"],
  },
  weekly_plan_for_week: {
    fn: (p) => {
      const sid = typeof p?.student_id === "string" ? p.student_id : "";
      const ws = typeof p?.week_start === "string" ? p.week_start : "";
      return sid && ws ? getWeeklyPlanForWeek(sid, ws) : Promise.resolve(undefined);
    },
    depends: ["weekly_plan"],
  },
  plans_for_ui: {
    fn: (p) =>
      listPlansForUI({
        student_id: typeof p?.student_id === "string" ? p.student_id : undefined,
        week_start: typeof p?.week_start === "string" ? p.week_start : undefined,
        teacher_id: typeof p?.teacher_id === "string" ? p.teacher_id : undefined,
      }),
    depends: ["weekly_plan", "daily_record", "student"],
  },
  daily_records: {
    fn: (p) => {
      if (typeof p?.weekly_plan_id === "string") {
        return listDailyRecordsByPlan(p.weekly_plan_id);
      }
      if (typeof p?.from === "string" && typeof p?.to === "string") {
        return listDailyRecordsInRange(p.from, p.to);
      }
      if (typeof p?.date === "string") {
        return listDailyRecordsForDate(p.date);
      }
      return Promise.resolve([] as DailyRecordRecord[]);
    },
    depends: ["daily_record"],
  },
  daily_records_with_student: {
    fn: (p) => {
      const date = typeof p?.date === "string" ? p.date : "";
      if (!date) return Promise.resolve([]);
      const teacher_id =
        typeof p?.teacher_id === "string" ? p.teacher_id : undefined;
      return listDailyRecordsWithStudentForDate(date, { teacher_id });
    },
    depends: ["daily_record", "weekly_plan", "student"],
  },
  review_records: {
    fn: (p) => {
      const sid = typeof p?.student_id === "string" ? p.student_id : "";
      return sid
        ? listReviewRecordsForStudent(sid)
        : Promise.resolve([] as ReviewRecordRecord[]);
    },
    depends: ["review_record"],
  },
  evaluations: {
    fn: (p) => {
      const sid = typeof p?.student_id === "string" ? p.student_id : "";
      return sid
        ? listEvaluationsForStudent(sid)
        : Promise.resolve([] as EvaluationRecord[]);
    },
    depends: ["evaluation"],
  },
  notifications: {
    fn: (p) => {
      const uid = typeof p?.user_id === "string" ? p.user_id : "";
      return uid
        ? listNotificationsForUser(uid)
        : Promise.resolve([] as NotificationRecord[]);
    },
    depends: ["notification"],
  },
  student_courses: {
    fn: (p) => {
      const sid = typeof p?.student_id === "string" ? p.student_id : "";
      return sid ? studentCoursesForStudent(sid) : Promise.resolve([]);
    },
    depends: ["student_course", "course"],
  },
  dashboard_stats: {
    fn: () => dashboardStats(),
    depends: ["student", "teacher", "daily_record", "weekly_plan"],
  },
  student_stats: {
    fn: (p) => {
      const sid = typeof p?.student_id === "string" ? p.student_id : "";
      return sid ? studentStats(sid) : Promise.resolve(null);
    },
    depends: [
      "student",
      "weekly_plan",
      "daily_record",
      "review_record",
      "evaluation",
    ],
  },
  tasks_today: {
    fn: (p) => {
      const sid = typeof p?.student_id === "string" ? p.student_id : "";
      return sid ? tasksToday(sid) : Promise.resolve(null);
    },
    depends: ["weekly_plan", "daily_record", "review_record", "evaluation"],
  },
  student_history: {
    fn: (p) => {
      const sid = typeof p?.student_id === "string" ? p.student_id : "";
      return sid ? studentHistory(sid) : Promise.resolve([]);
    },
    depends: ["weekly_plan", "daily_record"],
  },
  weekly_summary: {
    fn: (p) => {
      const sid = typeof p?.student_id === "string" ? p.student_id : "";
      const ws = typeof p?.week_start === "string" ? p.week_start : "";
      return sid && ws ? weeklySummary(sid, ws) : Promise.resolve(null);
    },
    depends: ["weekly_plan", "daily_record", "evaluation"],
  },
  attendance_report: {
    fn: (p) =>
      attendanceReport({
        from: typeof p?.from === "string" ? p.from : undefined,
        to: typeof p?.to === "string" ? p.to : undefined,
        teacher_id: typeof p?.teacher_id === "string" ? p.teacher_id : undefined,
      }),
    depends: ["daily_record", "student"],
  },
  leaderboard: {
    fn: () => leaderboard(),
    depends: ["student", "weekly_plan", "daily_record"],
  },
  teacher_aggregate_stats: {
    fn: (p) => {
      const tid = typeof p?.teacher_id === "string" ? p.teacher_id : "";
      return tid
        ? teacherAggregateStats(tid)
        : Promise.resolve({
            avgWeeklyCompletion: 0,
            avgQuality: "—",
            totalVersesThisWeek: 0,
            pendingReviews: 0,
            upcomingEvaluations: 0,
          });
    },
    depends: [
      "student",
      "daily_record",
      "weekly_plan",
      "review_record",
      "evaluation",
    ],
  },
  evaluations_for_teacher: {
    fn: (p) => {
      const tid = typeof p?.teacher_id === "string" ? p.teacher_id : "";
      return tid ? listEvaluationsForTeacher(tid) : Promise.resolve([]);
    },
    depends: ["evaluation", "student"],
  },
  reviews_for_teacher: {
    fn: (p) => {
      const tid = typeof p?.teacher_id === "string" ? p.teacher_id : "";
      return tid
        ? listReviewsForTeacher(tid)
        : Promise.resolve({ due: [], history: [] });
    },
    depends: ["review_record", "daily_record", "student", "weekly_plan"],
  },
  progress: {
    fn: (p) => {
      const sid = typeof p?.student_id === "string" ? p.student_id : "";
      return sid ? listProgressForStudent(sid) : Promise.resolve([]);
    },
    depends: ["progress"],
  },
};

export function getQueryDef(key: QueryKey): QueryDef {
  return QUERIES[key];
}

// Re-export common record types so call sites can `import type { ... } from "@/hooks/queries"`.
export type {
  CourseRecord,
  DailyRecordRecord,
  EvaluationRecord,
  NotificationRecord,
  ProgressRecord,
  ReviewRecordRecord,
  StudentRecord,
  TeacherRecord,
  UserRecord,
  WeeklyPlanRecord,
};
