/**
 * Rebuilds the role-specific slice of `UserProfile` from local state.
 *
 * Pages address their reads by profile id — `useQuery("tasks_today", {
 * student_id })`, `useQuery("plans_for_ui", { teacher_id })` — and the query
 * dispatcher returns an empty result when that id is missing. So a session
 * that comes back without `student_profile` / `teacher_profile` renders
 * "no data" over a perfectly full local DB.
 *
 * `/me` is the normal source of these, but it is unavailable on the two paths
 * that matter most: a page reload while offline, and offline login. Both
 * restore from the Dexie `auth` row instead, which is why the ids are cached
 * there — and why this falls back to matching `user_id` against the synced
 * `students` / `teachers` tables for rows written before that cache existed.
 */
import { listTeachers, type TeacherRecord } from "./repos/misc";
import { getStudent, listStudents, type StudentRecord } from "./repos/students";
import { type AuthRow } from "./schema";

import type { UserProfile } from "@/types/api";

export type CachedProfileSlice = Pick<
  UserProfile,
  "full_name" | "student_profile" | "teacher_profile"
>;

function toStudentProfile(row: StudentRecord): UserProfile["student_profile"] {
  return {
    id: row.id,
    full_name: row.full_name,
    grade: row.grade,
    enrollment_date: row.enrollment_date ?? "",
  };
}

function toTeacherProfile(row: TeacherRecord): UserProfile["teacher_profile"] {
  return {
    id: row.id,
    full_name: row.full_name,
    specialization: row.specialization,
    session_days: row.session_days,
    max_students: row.max_students,
    affiliation: row.affiliation,
    ring_name: row.ring_name,
  };
}

async function findStudent(row: AuthRow): Promise<StudentRecord | undefined> {
  if (row.student_profile_id) {
    const byId = await getStudent(row.student_profile_id);
    if (byId) return byId;
  }
  // Legacy auth row, or a profile id whose student row hasn't synced yet.
  const all = await listStudents();
  return all.find((s) => s.user_id === row.user_id);
}

async function findTeacher(row: AuthRow): Promise<TeacherRecord | undefined> {
  const teachers = await listTeachers();
  if (row.teacher_profile_id) {
    const byId = teachers.find((t) => t.id === row.teacher_profile_id);
    if (byId) return byId;
  }
  return teachers.find((t) => t.user_id === row.user_id);
}

/**
 * Best-effort — a locked or empty DB simply yields the cached ids with no
 * enrichment, which is still enough for pages to query by id.
 */
export async function resolveCachedProfile(row: AuthRow): Promise<CachedProfileSlice> {
  const slice: CachedProfileSlice = { full_name: row.full_name ?? "" };

  try {
    if (row.user_role === "student") {
      const student = await findStudent(row);
      if (student) {
        slice.student_profile = toStudentProfile(student);
        if (!slice.full_name) slice.full_name = student.full_name;
      } else if (row.student_profile_id) {
        slice.student_profile = {
          id: row.student_profile_id,
          full_name: slice.full_name,
          grade: "",
          enrollment_date: "",
        };
      }
    } else if (row.user_role === "teacher") {
      const teacher = await findTeacher(row);
      if (teacher) {
        slice.teacher_profile = toTeacherProfile(teacher);
        if (!slice.full_name) slice.full_name = teacher.full_name;
      } else if (row.teacher_profile_id) {
        slice.teacher_profile = {
          id: row.teacher_profile_id,
          full_name: slice.full_name,
          specialization: "",
          session_days: [],
          max_students: 0,
          affiliation: "",
        };
      }
    }
  } catch {
    // Decryption or IDB failure — fall through with whatever the auth row had.
  }

  return slice;
}
