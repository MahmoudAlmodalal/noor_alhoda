// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  phone_number: string;
  password: string;
}

export interface UserProfile {
  id: string;
  phone_number: string;
  role: "admin" | "teacher" | "student" | "parent";
  full_name: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: UserProfile;
}

// ─── Teachers ────────────────────────────────────────────────────────────────

export interface Teacher {
  id: string;
  full_name: string;
  specialization: string;
  session_days: string[];
  max_students: number;
  created_at: string;
}

export interface TeacherWithUser {
  id: string;
  phone_number: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  date_joined: string;
  teacher_profile?: Teacher;
}

export interface CreateTeacherRequest {
  phone_number: string;
  username: string;
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
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
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
