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

from accounts.models import User, Parent, ParentStudentLink
from teacher.models import Teacher
from courses.models import Course, StudentCourse
from evaluations.models import Evaluation
from notifications.models import Notification
from records.models import DailyRecord, ReviewRecord, WeeklyPlan
from students.models import Student
from students.selectors.student_selectors import student_list
from sync.models import Tombstone
from sync.services.resource_dicts import (
    course_to_dict,
    daily_record_to_dict,
    evaluation_to_dict,
    notification_to_dict,
    parent_student_link_to_dict,
    parent_to_dict,
    review_record_to_dict,
    student_course_to_dict,
    student_to_dict,
    teacher_to_dict,
    tombstone_to_dict,
    user_to_dict,
    weekly_plan_to_dict,
)


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
    Return a snapshot of records the actor can see whose `updated_at` is
    greater than `since`. Tombstones visible to the actor are included.

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

    # 8. Apply the `since` delta filter on real `updated_at` everywhere.
    users_qs = users_qs.filter(_since_q("updated_at", since))
    teachers_qs = teachers_qs.filter(_since_q("updated_at", since))
    parents_qs = parents_qs.filter(_since_q("updated_at", since))
    parent_links_qs = parent_links_qs.filter(_since_q("updated_at", since))
    students_delta = students_qs.filter(_since_q("updated_at", since))
    weekly_plans_qs = weekly_plans_qs.filter(_since_q("updated_at", since))
    daily_records_qs = daily_records_qs.filter(_since_q("updated_at", since))
    review_records_qs = review_records_qs.filter(_since_q("updated_at", since))
    evaluations_qs = evaluations_qs.filter(_since_q("updated_at", since))
    notifications_qs = notifications_qs.filter(_since_q("updated_at", since))
    courses_qs = courses_qs.filter(_since_q("updated_at", since))
    student_courses_qs = student_courses_qs.filter(_since_q("updated_at", since))

    # 9. Tombstones: return those whose scope the actor could have seen.
    tombstones_qs = Tombstone.objects.all()
    if since is not None:
        tombstones_qs = tombstones_qs.filter(deleted_at__gt=since)
    if not (actor.role == "admin" or actor.is_superuser):
        tombstones_qs = tombstones_qs.filter(
            Q(scope_user_id__isnull=True) | Q(scope_user_id=actor.id)
        )

    return {
        "resources": {
            "users": [user_to_dict(u) for u in users_qs],
            "teachers": [teacher_to_dict(t) for t in teachers_qs],
            "parents": [parent_to_dict(p) for p in parents_qs],
            "parent_student_links": [
                parent_student_link_to_dict(l) for l in parent_links_qs
            ],
            "students": [student_to_dict(s) for s in students_delta],
            "weekly_plans": [weekly_plan_to_dict(p) for p in weekly_plans_qs],
            "daily_records": [daily_record_to_dict(r) for r in daily_records_qs],
            "review_records": [
                review_record_to_dict(r) for r in review_records_qs
            ],
            "evaluations": [evaluation_to_dict(e) for e in evaluations_qs],
            "notifications": [notification_to_dict(n) for n in notifications_qs],
            "courses": [course_to_dict(c) for c in courses_qs],
            "student_courses": [
                student_course_to_dict(sc) for sc in student_courses_qs
            ],
        },
        "tombstones": [tombstone_to_dict(t) for t in tombstones_qs],
        "server_time": timezone.now().isoformat() if now is None else now.isoformat(),
    }
