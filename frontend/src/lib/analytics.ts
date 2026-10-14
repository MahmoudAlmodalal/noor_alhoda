/** Server-authoritative, admin-only analytics. Deliberately not cached in the
 * offline DB: reports must describe persisted records, never tentative writes.
 * Access is routed through the existing query dispatcher and change bus.
 */
import { api } from "@/lib/api";
import type { QueryParams } from "@/hooks/queries";

export interface Workload {
  unit?: "pages" | "verses";
  required: number;
  completed: number;
  remaining: number | null;
  percentage: number | null;
  unquantified_sessions: number;
  has_target: boolean;
  average_percentage?: number | null;
  eligible_students?: number;
}
export interface Recorder {
  id: string;
  name: string;
  role: string;
}
export interface HistoryEntry {
  id: string;
  source: string;
  date: string;
  surah: string;
  juz: number | null;
  from_ayah: number | null;
  to_ayah: number | null;
  from_page: number | null;
  to_page: number | null;
  lines: number;
  verses?: number | null;
  pages: number | null;
  new_pages?: number;
  new_verses?: number;
  quantified?: boolean;
  quality: string | null;
  note: string;
  result: string | null;
  recorder: Recorder | null;
}
export interface ExamEntry {
  id: string;
  source: string;
  title: string;
  surah: string;
  date: string;
  scheduled_date: string | null;
  evaluated_date: string | null;
  status: string;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  note: string;
  recorder: Recorder | null;
}
export interface Trend {
  date: string;
  memorization: number | null;
  memorization_verses: number | null;
  revision: number | null;
  attendance: number | null;
  exam: number | null;
}
export interface Attendance {
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  percentage: number | null;
  last_attendance?: string | null;
}
export interface ExamStats {
  total: number;
  completed: number;
  average: number | null;
  highest?: number | null;
  last?: number | null;
  last_max_score?: number | null;
  graded_count: number;
}
export interface StudentAnalytics {
  student: {
    id: string;
    name: string;
    active: boolean;
    teacher_name: string;
    ring: string;
    enrollment_date: string;
    reported_memorized_verses: number;
    current_surah: string;
    current_juz: number | null;
    current_page: number | null;
    last_activity: string | null;
  };
  memorization: Workload;
  verse_memorization: Workload;
  memorization_goal: Workload;
  revision: Workload;
  attendance: Attendance;
  exams: ExamStats;
  cumulative: {
    pages: number;
    verses: number;
    unquantified_sessions: number;
    as_of: string;
  };
  sessions: {
    memorization: number;
    revision: number;
    recitation: number;
    last_memorization: string | null;
    last_revision: string | null;
  };
  trends: Trend[];
  weekly_trends: Trend[];
  monthly_trends: Trend[];
  memorization_history: HistoryEntry[];
  revision_history: HistoryEntry[];
  exam_history: ExamEntry[];
  attendance_history: {
    id: string;
    date: string;
    status: string;
    counted: boolean;
    recorder: Recorder | null;
  }[];
  targets: Target[];
  timeline: {
    id: string;
    date: string;
    type: string;
    details: string;
    result: string | null;
    note: string;
  }[];
}
export interface Target {
  id: string;
  source: string;
  date: string;
  end?: string;
  memorization_pages?: number;
  revision_pages?: number;
  verses?: number;
  kind?: string;
  text?: string;
  from_ayah?: number | null;
  to_ayah?: number | null;
  remaining_ranges?: number[][] | null;
  status?: string;
}
export interface TeacherProfile {
  id: string;
  name: string;
  ring: string;
  phone: string;
  email: string;
  joined: string;
  registered_students: number;
  active_students: number;
}
export interface TeacherAnalytics {
  teacher: TeacherProfile;
  period: { from: string | null; to: string; group_by: string };
  methods: string[];
  summary: {
    students: number;
    active_students: number;
    memorization: Workload;
    verse_memorization: Workload;
    memorization_goal: Workload;
    revision: Workload;
    attendance: Attendance;
    exams: ExamStats;
    recitation_sessions: number;
  };
  students: StudentAnalytics[];
  trends: Trend[];
  comparison: {
    id: string;
    name: string;
    memorization: Workload;
    revision: Workload;
    attendance: number | null;
    exam: number | null;
  }[];
  pagination: { page: number; page_size: number; total: number; pages: number };
  generated_at: string;
}
export type StudentAnalyticsResponse = StudentAnalytics &
  Pick<TeacherAnalytics, "teacher" | "period" | "methods">;
export const labels: Record<string, string> = {
  present: "حاضر",
  late: "متأخر",
  absent: "غائب",
  excused: "مستأذن",
  passed: "ناجح",
  failed: "راسب",
  missed: "متغيب",
  scheduled: "مجدول",
  recorded: "درجة مسجلة",
  excellent: "ممتاز",
  good: "جيد جداً",
  acceptable: "جيد",
  weak: "ضعيف",
  none: "لم يسمّع",
  pass: "ناجح",
  fail: "راسب",
  pending: "معلق",
  memorization: "إتمام حفظ",
  revision: "جلسة مراجعة",
  exam: "اختبار",
  attendance: "حضور",
  evaluation_update: "تحديث تقييم",
};
export const displayNumber = (value: number | null | undefined, suffix = "") =>
  value == null
    ? "—"
    : `${new Intl.NumberFormat("ar", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
export function analyticsPath(teacherId: string, studentId?: string) {
  return `/api/reports/teachers/${encodeURIComponent(teacherId)}/${studentId ? `students/${encodeURIComponent(studentId)}/` : ""}analytics/`;
}
export function analyticsParams(params: QueryParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(
        ([key, value]) =>
          !["teacher_id", "student_id"].includes(key) &&
          value !== undefined &&
          value !== "",
      )
      .map(([key, value]) => [key, String(value)]),
  );
}
export async function fetchAnalytics(params: QueryParams, student = false) {
  const response = await api.get(
    analyticsPath(
      String(params.teacher_id),
      student ? String(params.student_id) : undefined,
    ),
    analyticsParams(params),
  );
  if (!response.success)
    throw new Error(
      response.error?.message ||
        "تعذر تحميل التحليلات. تحقق من الاتصال ثم أعد المحاولة.",
    );
  return response.data;
}
export async function exportAnalytics(
  teacherId: string,
  params: QueryParams,
  studentId?: string,
  print = false,
) {
  const popup = print ? window.open("about:blank", "_blank") : null;
  if (print && !popup)
    throw new Error("يرجى السماح بفتح نافذة التقرير للطباعة.");
  if (popup) popup.document.body.textContent = "جارٍ إعداد التقرير…";
  const query = new URLSearchParams({
    ...analyticsParams(params),
    ...(print ? { print: "1" } : {}),
  });
  try {
    const blob = await api.downloadBlob(
      `${analyticsPath(teacherId, studentId)}pdf/?${query}`,
    );
    if (!blob || blob.type !== "application/pdf")
      throw new Error(
        "تعذر إعداد التقرير. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.",
      );
    const url = URL.createObjectURL(blob);
    if (popup) {
      popup.onload = () => {
        popup.focus();
        popup.print();
      };
      popup.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = `${studentId ? "student" : "teacher"}-analytics.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    // PDF viewers load asynchronously. Keep the URL alive long enough for printing.
    window.setTimeout(() => URL.revokeObjectURL(url), 300_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

export const unitLabel = (value?: string) =>
  value === "verses" ? "آية" : "صفحة";
