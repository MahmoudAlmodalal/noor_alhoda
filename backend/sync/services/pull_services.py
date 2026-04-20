"""
Sync pull service. Returns the delta of records the actor can see since a
given timestamp, plus tombstones for rows that were hard-deleted in the
same window.

RBAC is enforced by composing existing selectors — never by hand-rolling
"what can this user see" here.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from django.db.models import Q
from django.utils import timezone

from accounts.models import User, Teacher, Parent, ParentStudentLink
from courses.models import Course, StudentCourse
from evaluations.models import Evaluation
from notifications.models import Notification
from records.models import DailyRecord, ReviewRecord, WeeklyPlan
from students.models import Student
from students.selectors.student_selectors import student_list
from sync.models import Tombstone


# ---------------------------------------------------------------------------
# Serializers (plain dict — intentionally minimal, no DRF to keep pull cheap)
# ---------------------------------------------------------------------------

def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat()


def _user_to_dict(u: User) -> dict[str, Any]:
    return {
        "id": str(u.id),
        "national_id": u.national_id,
        "phone_number": u.phone_number,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "role": u.role,
        "is_active": u.is_active,
        "date_joined": _iso(u.date_joined),
        # no updated_at on User — fall back to date_joined for delta
        "updated_at": _iso(u.date_joined),
    }


def _teacher_to_dict(t: Teacher) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "user_id": str(t.user_id),
        "full_name": t.full_name,
        "specialization": t.specialization,
        "session_days": list(t.session_days or []),
        "max_students": t.max_students,
        "affiliation": t.affiliation,
        "ring_name": t.ring_name,
        "created_at": _iso(t.created_at),
        "updated_at": _iso(t.created_at),
    }


def _parent_to_dict(p: Parent) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "user_id": str(p.user_id),
        "full_name": p.full_name,
        "phone_number": p.phone_number,
        "created_at": _iso(p.created_at),
        "updated_at": _iso(p.created_at),
    }


def _parent_student_link_to_dict(link: ParentStudentLink) -> dict[str, Any]:
    return {
        "id": str(link.id),
        "parent_id": str(link.parent_id),
        "student_id": str(link.student_id),
        "created_at": _iso(link.created_at),
        "updated_at": _iso(link.created_at),
    }


def _student_to_dict(s: Student) -> dict[str, Any]:
    return {
        "id": str(s.id),
        "user_id": str(s.user_id),
        "full_name": s.full_name,
        "national_id": s.national_id,
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
        "enrollment_date": str(s.enrollment_date) if s.enrollment_date else None,
        "created_at": _iso(s.created_at),
        "updated_at": _iso(s.updated_at),
    }


def _weekly_plan_to_dict(p: WeeklyPlan) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "student_id": str(p.student_id),
        "week_number": p.week_number,
        "week_start": str(p.week_start),
        "total_required": p.total_required,
        "total_achieved": p.total_achieved,
        "created_at": _iso(p.created_at),
        # WeeklyPlan has no updated_at; fall back to created_at. Clients
        # recompute totals from daily_records so staleness here is benign.
        "updated_at": _iso(p.created_at),
    }


def _daily_record_to_dict(r: DailyRecord) -> dict[str, Any]:
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


def _review_record_to_dict(r: ReviewRecord) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "student_id": str(r.student_id),
        "surah_name": r.surah_name,
        "reviewed_date": str(r.reviewed_date),
        "quality": r.quality,
        "note": r.note,
        "recorded_by_id": str(r.recorded_by_id) if r.recorded_by_id else None,
        "created_at": _iso(r.created_at),
        "updated_at": _iso(r.created_at),
    }


def _evaluation_to_dict(e: Evaluation) -> dict[str, Any]:
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


def _notification_to_dict(n: Notification) -> dict[str, Any]:
    return {
        "id": str(n.id),
        "recipient_id": str(n.recipient_id),
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "is_read": n.is_read,
        "created_at": _iso(n.created_at),
        "updated_at": _iso(n.created_at),
    }


def _course_to_dict(c: Course) -> dict[str, Any]:
    return {
        "id": str(c.id),
        "name": c.name,
        "description": c.description,
        "created_at": _iso(c.created_at),
        "updated_at": _iso(c.updated_at),
    }


def _student_course_to_dict(sc: StudentCourse) -> dict[str, Any]:
    return {
        "id": str(sc.id),
        "student_id": str(sc.student_id),
        "course_id": str(sc.course_id),
        "is_completed": sc.is_completed,
        "completion_date": str(sc.completion_date) if sc.completion_date else None,
        "created_at": _iso(sc.created_at),
        "updated_at": _iso(sc.updated_at),
    }


def _tombstone_to_dict(t: Tombstone) -> dict[str, Any]:
    return {
        "resource": t.resource,
        "uuid": str(t.resource_uuid),
        "deleted_at": _iso(t.deleted_at),
    }


# ---------------------------------------------------------------------------
# Delta filter helpers
# ---------------------------------------------------------------------------

def _since_q(field: str, since: datetime | None) -> Q:
    if since is None:
        return Q()
    return Q(**{f"{field}__gt": since})


# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------

def sync_pull(*, actor: User, since: datetime | None = None) -> dict[str, Any]:
    """
    Return a snapshot of records the actor can see whose `updated_at`
    (or `created_at` for models without updated_at) is greater than
    `since`. Tombstones visible to the actor are included.

    Visibility is composed from existing selectors so RBAC is never
    forked — if `student_list` says the actor can see student X, then
    the pull endpoint returns X and everything related to X.
    """
    now = timezone.now()

    # 1. Visible students (role-aware, via existing selector).
    students_qs = student_list(filters={}, user=actor).select_related("user", "teacher")
    visible_student_ids = list(students_qs.values_list("id", flat=True))

    # 2. Teachers: admin + teacher see all teachers; parent/student see
    #    only the teacher(s) of their visible students.
    if actor.role in ("admin", "teacher") or actor.is_superuser:
        teachers_qs = Teacher.objects.select_related("user").all()
    else:
        teacher_ids = students_qs.exclude(teacher__isnull=True).values_list(
            "teacher_id", flat=True
        )
        teachers_qs = Teacher.objects.select_related("user").filter(id__in=teacher_ids)

    # 3. Parents: only those linked to visible students.
    parent_links_qs = ParentStudentLink.objects.select_related(
        "parent__user"
    ).filter(student_id__in=visible_student_ids)
    parent_ids = list(parent_links_qs.values_list("parent_id", flat=True))
    parents_qs = Parent.objects.select_related("user").filter(id__in=parent_ids)

    # 4. Users: every user referenced above (actor, students' users,
    #    teachers' users, parents' users).
    user_ids: set = {actor.id}
    user_ids.update(students_qs.values_list("user_id", flat=True))
    user_ids.update(teachers_qs.values_list("user_id", flat=True))
    user_ids.update(parents_qs.values_list("user_id", flat=True))
    users_qs = User.objects.filter(id__in=user_ids)

    # 5. Records scoped to visible students.
    weekly_plans_qs = WeeklyPlan.objects.filter(student_id__in=visible_student_ids)
    daily_records_qs = DailyRecord.objects.filter(
        weekly_plan__student_id__in=visible_student_ids
    )
    review_records_qs = ReviewRecord.objects.filter(
        student_id__in=visible_student_ids
    )
    evaluations_qs = Evaluation.objects.filter(student_id__in=visible_student_ids)

    # 6. Notifications are per-recipient.
    notifications_qs = Notification.objects.filter(recipient=actor)

    # 7. Courses catalog is visible to every authenticated user.
    courses_qs = Course.objects.all()
    student_courses_qs = StudentCourse.objects.filter(
        student_id__in=visible_student_ids
    )

    # 8. Apply the `since` delta filter.
    users_qs = users_qs.filter(_since_q("date_joined", since))
    teachers_qs = teachers_qs.filter(_since_q("created_at", since))
    parents_qs = parents_qs.filter(_since_q("created_at", since))
    parent_links_qs = parent_links_qs.filter(_since_q("created_at", since))
    students_delta = students_qs.filter(_since_q("updated_at", since))
    weekly_plans_qs = weekly_plans_qs.filter(_since_q("created_at", since))
    daily_records_qs = daily_records_qs.filter(_since_q("updated_at", since))
    review_records_qs = review_records_qs.filter(_since_q("created_at", since))
    evaluations_qs = evaluations_qs.filter(_since_q("updated_at", since))
    notifications_qs = notifications_qs.filter(_since_q("created_at", since))
    courses_qs = courses_qs.filter(_since_q("updated_at", since))
    student_courses_qs = student_courses_qs.filter(_since_q("updated_at", since))

    # 9. Tombstones: return those whose scope the actor could have seen.
    #    For admin + teacher/parent/student whose scope matches, include.
    #    We also always include tombstones where scope_user_id is null
    #    (universally visible deletions, e.g., courses).
    tombstones_qs = Tombstone.objects.all()
    if since is not None:
        tombstones_qs = tombstones_qs.filter(deleted_at__gt=since)
    if not (actor.role == "admin" or actor.is_superuser):
        tombstones_qs = tombstones_qs.filter(
            Q(scope_user_id__isnull=True) | Q(scope_user_id=actor.id)
        )

    return {
        "resources": {
            "users": [_user_to_dict(u) for u in users_qs],
            "teachers": [_teacher_to_dict(t) for t in teachers_qs],
            "parents": [_parent_to_dict(p) for p in parents_qs],
            "parent_student_links": [
                _parent_student_link_to_dict(l) for l in parent_links_qs
            ],
            "students": [_student_to_dict(s) for s in students_delta],
            "weekly_plans": [_weekly_plan_to_dict(p) for p in weekly_plans_qs],
            "daily_records": [_daily_record_to_dict(r) for r in daily_records_qs],
            "review_records": [
                _review_record_to_dict(r) for r in review_records_qs
            ],
            "evaluations": [_evaluation_to_dict(e) for e in evaluations_qs],
            "notifications": [_notification_to_dict(n) for n in notifications_qs],
            "courses": [_course_to_dict(c) for c in courses_qs],
            "student_courses": [
                _student_course_to_dict(sc) for sc in student_courses_qs
            ],
        },
        "tombstones": [_tombstone_to_dict(t) for t in tombstones_qs],
        "server_time": _iso(now),
    }
