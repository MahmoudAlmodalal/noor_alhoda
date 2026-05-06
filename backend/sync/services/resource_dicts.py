"""
Shared dict-serializers for the sync endpoints (pull + push).

Each function takes a domain model instance and returns a plain dict in the
same shape the frontend IndexedDB mirror expects. Kept intentionally minimal
(no DRF) — these run hot on pull.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from accounts.models import User, Parent, ParentStudentLink
from teacher.models import Teacher
from courses.models import Course, StudentCourse
from evaluations.models import Evaluation
from notifications.models import Notification
from records.models import DailyRecord, ReviewRecord, WeeklyPlan
from students.models import Student
from sync.models import Tombstone


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat()


def user_to_dict(u: User) -> dict[str, Any]:
    return {
        "id": str(u.id),
        "national_id": u.national_id,
        "phone_number": u.phone_number,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "role": u.role,
        "is_active": u.is_active,
        "date_joined": _iso(u.date_joined),
        "updated_at": _iso(u.updated_at),
    }


def teacher_to_dict(t: Teacher) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "user_id": str(t.user_id),
        "full_name": t.full_name,
        "specialization": t.specialization,
        "session_days": list(t.session_days or []),
        "max_students": t.max_students,
        "affiliation": t.affiliation,
        "ring_name": t.ring_name,
        "course_ids": [str(c.id) for c in t.courses.all()],
        "created_at": _iso(t.created_at),
        "updated_at": _iso(t.updated_at),
    }


def parent_to_dict(p: Parent) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "user_id": str(p.user_id),
        "full_name": p.full_name,
        "phone_number": p.phone_number,
        "created_at": _iso(p.created_at),
        "updated_at": _iso(p.updated_at),
    }


def parent_student_link_to_dict(link: ParentStudentLink) -> dict[str, Any]:
    return {
        "id": str(link.id),
        "parent_id": str(link.parent_id),
        "student_id": str(link.student_id),
        "created_at": _iso(link.created_at),
        "updated_at": _iso(link.updated_at),
    }


def student_to_dict(s: Student) -> dict[str, Any]:
    return {
        "id": str(s.id),
        "user_id": str(s.user_id),
        "full_name": s.full_name,
        "national_id": s.user.national_id,
        "birthdate": str(s.birthdate) if s.birthdate else None,
        "grade": s.grade,
        "address": s.address or "",
        "whatsapp": s.whatsapp or "",
        "mobile": s.mobile or "",
        "previous_courses": s.previous_courses,
        "desired_courses": s.desired_courses,
        "guardian_name": s.guardian_name,
        "guardian_national_id": s.guardian_national_id or "",
        "guardian_mobile": s.guardian_mobile,
        "teacher_id": str(s.teacher_id) if s.teacher_id else None,
        "health_status": s.health_status,
        "health_note": s.health_note,
        "skills": s.skills or {},
        "review_interval_days": s.review_interval_days,
        "current_surah": s.current_surah or "",
        "current_juz": s.current_juz,
        "memorized_verses": s.memorized_verses,
        "enrollment_date": str(s.enrollment_date) if s.enrollment_date else None,
        "created_at": _iso(s.created_at),
        "updated_at": _iso(s.updated_at),
    }


def weekly_plan_to_dict(p: WeeklyPlan) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "student_id": str(p.student_id),
        "week_number": p.week_number,
        "week_start": str(p.week_start),
        "total_required": p.total_required,
        "total_achieved": p.total_achieved,
        "created_at": _iso(p.created_at),
        "updated_at": _iso(p.updated_at),
    }


def daily_record_to_dict(r: DailyRecord) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "weekly_plan_id": str(r.weekly_plan_id),
        "day": r.day,
        "date": str(r.date),
        "attendance": r.attendance,
        "required_verses": r.required_verses,
        "achieved_verses": r.achieved_verses,
        "surah_name": r.surah_name,
        "quality": r.quality,
        "note": r.note,
        "result": r.result,
        "recorded_by_id": str(r.recorded_by_id) if r.recorded_by_id else None,
        "created_at": _iso(r.created_at),
        "updated_at": _iso(r.updated_at),
    }


def review_record_to_dict(r: ReviewRecord) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "student_id": str(r.student_id),
        "surah_name": r.surah_name,
        "reviewed_date": str(r.reviewed_date),
        "quality": r.quality,
        "note": r.note,
        "recorded_by_id": str(r.recorded_by_id) if r.recorded_by_id else None,
        "created_at": _iso(r.created_at),
        "updated_at": _iso(r.updated_at),
    }


def evaluation_to_dict(e: Evaluation) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "student_id": str(e.student_id),
        "title": e.title,
        "surah_range": e.surah_range,
        "scheduled_date": str(e.scheduled_date),
        "status": e.status,
        "result_note": e.result_note,
        "created_by_id": str(e.created_by_id) if e.created_by_id else None,
        "created_at": _iso(e.created_at),
        "updated_at": _iso(e.updated_at),
    }


def notification_to_dict(n: Notification) -> dict[str, Any]:
    return {
        "id": str(n.id),
        "recipient_id": str(n.recipient_id),
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "is_read": n.is_read,
        "created_at": _iso(n.created_at),
        "updated_at": _iso(n.updated_at),
    }


def course_to_dict(c: Course) -> dict[str, Any]:
    return {
        "id": str(c.id),
        "name": c.name,
        "description": c.description,
        "created_at": _iso(c.created_at),
        "updated_at": _iso(c.updated_at),
    }


def student_course_to_dict(sc: StudentCourse) -> dict[str, Any]:
    return {
        "id": str(sc.id),
        "student_id": str(sc.student_id),
        "course_id": str(sc.course_id),
        "is_completed": sc.is_completed,
        "completion_date": str(sc.completion_date) if sc.completion_date else None,
        "created_at": _iso(sc.created_at),
        "updated_at": _iso(sc.updated_at),
    }


def tombstone_to_dict(t: Tombstone) -> dict[str, Any]:
    return {
        "resource": t.resource,
        "uuid": str(t.resource_uuid),
        "deleted_at": _iso(t.deleted_at),
    }


# Resource name -> (model, to_dict) lookup for the push handlers
RESOURCE_DICT_MAP: dict[str, Any] = {
    "user": (User, user_to_dict),
    "student": (Student, student_to_dict),
    "teacher": (Teacher, teacher_to_dict),
    "parent": (Parent, parent_to_dict),
    "parent_student_link": (ParentStudentLink, parent_student_link_to_dict),
    "weekly_plan": (WeeklyPlan, weekly_plan_to_dict),
    "daily_record": (DailyRecord, daily_record_to_dict),
    "review_record": (ReviewRecord, review_record_to_dict),
    "evaluation": (Evaluation, evaluation_to_dict),
    "notification": (Notification, notification_to_dict),
    "course": (Course, course_to_dict),
    "student_course": (StudentCourse, student_course_to_dict),
}
