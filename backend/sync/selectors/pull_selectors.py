"""
Read-only visibility selectors for the sync pull endpoint. Each function
returns a base queryset scoped to what `actor` is allowed to see. The
caller is expected to apply any `updated_at` delta filter for the wire
response (use `since_q` below).
"""
from __future__ import annotations

from datetime import datetime

from django.db.models import Q, QuerySet

from accounts.models import Parent, ParentStudentLink, User
from courses.models import Course, StudentCourse
from evaluations.models import Evaluation
from notifications.models import Notification
from records.models import DailyRecord, ReviewRecord, WeeklyPlan
from students.models import Student
from students.selectors.student_selectors import student_list
from progress.models import StudentProgress
from sync.models import Tombstone
from teacher.models import Teacher


def since_q(field: str, since: datetime | None) -> Q:
    """Build a `field__gt=since` filter, or an identity `Q()` when `since` is None."""
    if since is None:
        return Q()
    return Q(**{f"{field}__gt": since})


def pull_visible_students(*, actor: User) -> QuerySet[Student]:
    return student_list(filters={}, user=actor).select_related("user", "teacher")


def pull_visible_teachers(*, actor: User, student_ids: list) -> QuerySet[Teacher]:
    # Admin/superuser see every teacher (full oversight).
    if actor.is_superuser or actor.role == "admin":
        return Teacher.objects.select_related("user").prefetch_related("courses").all()

    # A teacher's local DB only needs their own teacher row — they don't
    # collaborate with peers' profiles offline.
    if actor.role == "teacher" and hasattr(actor, "teacher_profile"):
        return (
            Teacher.objects.select_related("user")
            .prefetch_related("courses")
            .filter(id=actor.teacher_profile.id)
        )

    # Parent/student see the teachers of the students they can see.
    teacher_ids = (
        Student.objects.filter(id__in=student_ids)
        .exclude(teacher__isnull=True)
        .values_list("teacher_id", flat=True)
    )
    return (
        Teacher.objects.select_related("user")
        .prefetch_related("courses")
        .filter(id__in=teacher_ids)
    )


def pull_visible_parent_links(*, student_ids: list) -> QuerySet[ParentStudentLink]:
    return ParentStudentLink.objects.select_related("parent__user").filter(
        student_id__in=student_ids
    )


def pull_visible_parents(*, parent_ids: list) -> QuerySet[Parent]:
    return Parent.objects.select_related("user").filter(id__in=parent_ids)


def pull_visible_users(*, user_ids) -> QuerySet[User]:
    return User.objects.filter(id__in=user_ids)


def pull_weekly_plans_for_students(*, student_ids: list) -> QuerySet[WeeklyPlan]:
    return WeeklyPlan.objects.filter(student_id__in=student_ids)


def pull_daily_records_for_students(*, student_ids: list) -> QuerySet[DailyRecord]:
    return DailyRecord.objects.filter(weekly_plan__student_id__in=student_ids)


def pull_review_records_for_students(*, student_ids: list) -> QuerySet[ReviewRecord]:
    return ReviewRecord.objects.filter(student_id__in=student_ids)


def pull_evaluations_for_students(*, student_ids: list) -> QuerySet[Evaluation]:
    return Evaluation.objects.filter(student_id__in=student_ids)


def pull_notifications_for(*, actor: User) -> QuerySet[Notification]:
    return Notification.objects.filter(recipient=actor)


def pull_courses() -> QuerySet[Course]:
    return Course.objects.all()


def pull_student_courses_for_students(*, student_ids: list) -> QuerySet[StudentCourse]:
    return StudentCourse.objects.filter(student_id__in=student_ids)


def pull_progress_for_students(*, student_ids: list) -> QuerySet[StudentProgress]:
    return StudentProgress.objects.filter(student_id__in=student_ids)


def pull_tombstones(*, actor: User, since: datetime | None = None) -> QuerySet[Tombstone]:
    """
    Tombstones have their own deleted_at column (not updated_at) and are
    role-scoped: admins see every deletion; everyone else sees deletions
    whose scope is theirs or globally unscoped.
    """
    qs = Tombstone.objects.all()
    if since is not None:
        qs = qs.filter(deleted_at__gt=since)
    if not (actor.role == "admin" or actor.is_superuser):
        qs = qs.filter(Q(scope_user_id__isnull=True) | Q(scope_user_id=actor.id))
    return qs
