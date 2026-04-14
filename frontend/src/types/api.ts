// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  national_id: string;
  password: string;
}

export interface UserProfile {
  id: string;
  national_id: string;
  phone_number: string;
  role: "admin" | "teacher" | "student" | "parent";
  full_name: string;
  student_profile?: {
    id: string;
    full_name: string;
    grade: string;
    enrollment_date: string;
  };
  teacher_profile?: {
    id: string;
    full_name: string;
    specialization: string;
    session_days: string[];
    max_students: number;
  };
  parent_profile?: {
    id: string;
    full_name: string;
    children: {
      student_id: string;
      student_name: string;
    }[];
  };
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: UserProfile;
}

export interface OtpSendRequest {
  national_id: string;
}

export interface OtpVerifyRequest {
  national_id: string;
  code: string;
  new_password: string;
}

// ─── Teachers ────────────────────────────────────────────────────────────────

export interface Teacher {
  id: string;
  user_id: string;
  phone_number: string;
  full_name: string;
  specialization: string;
  affiliation?: string;
  session_days: string[];
  max_students: number;
  created_at: string;
}

export interface TeacherWithUser {
  id: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  date_joined: string;
  teacher_profile?: Teacher;
}

export interface CreateTeacherRequest {
  phone_number: string;
  first_name: string;
  last_name: string;
  password: string;
  full_name: string;
  specialization?: string;
  session_days?: string[];
  max_students?: number;
}

// ─── Students ────────────────────────────────────────────────────────────────

export interface Student {
  id: string;
  full_name: string;
  national_id: string;
  birthdate: string;
  grade: string;
  address: string;
  whatsapp: string;
  mobile: string;
  previous_courses: string;
  desired_courses: string;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_account_type: string | null;
  guardian_name: string;
  guardian_national_id: string | null;
  guardian_mobile: string;
  teacher_id: string | null;
  teacher_name: string | null;
  health_status: string;
  health_note: string;
  affiliation: string;
  skills: Record<string, boolean>;
  is_active: boolean;
  enrollment_date: string;
}

export interface CreateStudentRequest {
  phone_number: string;
  full_name: string;
  national_id: string;
  birthdate: string;
  grade: string;
  address?: string;
  whatsapp?: string;
  mobile?: string;
  previous_courses?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  bank_account_type?: string;
  guardian_name: string;
  guardian_mobile: string;
  guardian_national_id?: string;
  health_status?: string;
  health_note?: string;
  skills?: Record<string, boolean>;
  teacher_id?: string;
  password?: string;
}

export interface AssignTeacherRequest {
  teacher_id: string;
}

// ─── Dashboard / Reports ─────────────────────────────────────────────────────

export interface DashboardStats {
  total_students: number;
  total_teachers: number;
  today: {
    present: number;
    absent: number;
    total_recorded: number;
  };
  this_week: {
    avg_completion_rate: number;
  };
  outstanding_count: number;
  outstanding?: number;
  late?: number;
}

export interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  active: boolean;
  actionText: string;
}

export interface DailyRecord {
  id: string;
  day: string;
  date: string;
  attendance: AttendanceStatus;
  required_verses: number;
  achieved_verses: number;
  surah_name: string;
  quality: "excellent" | "good" | "acceptable" | "weak" | "none";
  result: "pass" | "fail" | "pending";
  note: string;
  student_id?: string;
  student_name?: string;
  created_at?: string;
  updated_at?: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface BulkAttendanceRequest {
  date: string;
  records: { student_id: string; attendance: AttendanceStatus }[];
}

export interface BulkAttendanceResponse {
  records: { student_id: string; id: string }[];
}

export interface CreateRecordRequest {
  student_id: string;
  date: string;
  attendance: AttendanceStatus;
  required_verses?: number;
  achieved_verses?: number;
  surah_name?: string;
  quality?: string;
  note?: string;
}

export interface UpdateRecordRequest {
  attendance?: AttendanceStatus;
  required_verses?: number;
  achieved_verses?: number;
  surah_name?: string;
  quality?: string;
  note?: string;
  result?: string;
}

export interface StudentStats {
  student_id: string;
  student_name: string;
  attendance_rate: number;
  total_days: number;
  present_days: number;
  total_present: number;
  total_absent: number;
  total_required_verses: number;
  total_achieved_verses: number;
  overall_completion_rate: number;
  overall_rate: string;
  avg_grade: string;
  memorized_parts: number;
  streak: number;
  points: number;
  memorization_level: string;
  current_goal: string;
  goal_progress: number;
  today_record: {
    attendance: string;
    quality: string;
    result: string;
    surah_name: string;
    achieved_verses: number;
    required_verses: number;
  } | null;
  // Legacy compat
  memorized_ajza?: number;
  review_count?: number;
  longest_streak?: number;
}

export interface HistoryEntry {
  id: string;
  date: string;
  day?: string;
  attendance: AttendanceStatus;
  surah_name?: string;
  required_verses?: number;
  achieved_verses?: number;
  quality?: string;
  note?: string;
}

export interface WeeklySummary {
  week_start: string;
  total_required: number;
  total_achieved: number;
  completion_rate: number;
  records: HistoryEntry[];
}

export interface WeeklyPlan {
  id: string;
  student_id: string;
  student_name?: string;
  week_number: number;
  week_start: string;
  total_required: number;
  total_achieved: number;
  completion_rate?: number;
  created_at?: string;
}

export interface WeeklyPlanRequest {
  student_id: string;
  week_start: string;
  week_number?: number;
  total_required: number;
}

export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  student_name: string;
  total_achieved: number;
  total_required: number;
  present_days: number;
  ring_name?: string;
}

export interface AttendanceReportRow {
  student_id: string;
  student_name: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  rate: number;
}

export interface AttendanceReport {
  month: number;
  year: number;
  teacher_id?: string;
  students: AttendanceReportRow[];
  summary: {
    total_records: number;
    present: number;
    absent: number;
    excused: number;
    attendance_rate: number;
  };
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

export interface NotificationsPayload {
  items?: Notification[];
  results?: Notification[];
  unread_count: number;
}

export interface AnnounceRequest {
  title: string;
  body: string;
  target_roles?: ("teacher" | "student" | "parent")[];
  target_user_ids?: string[];
}

// ─── Courses ─────────────────────────────────────────────────────────────────

export interface Course {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCourseRequest {
  name: string;
  description?: string;
}

export interface UpdateCourseRequest {
  name?: string;
  description?: string;
}

export interface StudentCourseStatus {
  course_id: string;
  course_name: string;
  description: string;
  is_completed: boolean;
  completion_date: string | null;
}

export interface ToggleStudentCourseRequest {
  course_id: string;
  is_completed: boolean;
}

// ─── Generic API Wrapper ─────────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
    details?: Record<string, string | string[]>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
