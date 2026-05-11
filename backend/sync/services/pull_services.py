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

from django.utils import timezone

from accounts.models import User
from sync.models import SyncGeneration
from sync.selectors.pull_selectors import (
    pull_courses,
    pull_daily_records_for_students,
    pull_evaluations_for_students,
    pull_notifications_for,
    pull_progress_for_students,
    pull_review_records_for_students,
    pull_student_courses_for_students,
    pull_tombstones,
    pull_visible_parent_links,
    pull_visible_parents,
    pull_visible_students,
    pull_visible_teachers,
    pull_visible_users,
    pull_weekly_plans_for_students,
    since_q,
)
from sync.services.resource_dicts import (
    course_to_dict,
    daily_record_to_dict,
    evaluation_to_dict,
    notification_to_dict,
    parent_student_link_to_dict,
    parent_to_dict,
    progress_to_dict,
    review_record_to_dict,
    student_course_to_dict,
    student_to_dict,
    teacher_to_dict,
    tombstone_to_dict,
    user_to_dict,
    weekly_plan_to_dict,
)


def sync_pull(*, actor: User, since: datetime | None = None) -> dict[str, Any]:
    """
    Return a snapshot of records the actor can see whose `updated_at` is
    greater than `since`. Tombstones visible to the actor are included.

    Visibility is composed from existing selectors so RBAC is never
    forked — if `student_list` says the actor can see student X, then
    the pull endpoint returns X and everything related to X.
    """
    now = timezone.now()

    students_qs = pull_visible_students(actor=actor)
    visible_student_ids = list(students_qs.values_list("id", flat=True))

    teachers_qs = pull_visible_teachers(actor=actor, student_ids=visible_student_ids)

    parent_links_qs = pull_visible_parent_links(student_ids=visible_student_ids)
    parent_ids = list(parent_links_qs.values_list("parent_id", flat=True))
    parents_qs = pull_visible_parents(parent_ids=parent_ids)

    user_ids: set = {actor.id}
    user_ids.update(students_qs.values_list("user_id", flat=True))
    user_ids.update(teachers_qs.values_list("user_id", flat=True))
    user_ids.update(parents_qs.values_list("user_id", flat=True))
    users_qs = pull_visible_users(user_ids=user_ids)

    weekly_plans_qs = pull_weekly_plans_for_students(student_ids=visible_student_ids)
    daily_records_qs = pull_daily_records_for_students(student_ids=visible_student_ids)
    review_records_qs = pull_review_records_for_students(student_ids=visible_student_ids)
    evaluations_qs = pull_evaluations_for_students(student_ids=visible_student_ids)
    notifications_qs = pull_notifications_for(actor=actor)
    courses_qs = pull_courses()
    student_courses_qs = pull_student_courses_for_students(student_ids=visible_student_ids)
    progress_qs = pull_progress_for_students(student_ids=visible_student_ids)

    # Apply the `updated_at` delta everywhere.
    delta = since_q("updated_at", since)
    users_qs = users_qs.filter(delta)
    teachers_qs = teachers_qs.filter(delta)
    parents_qs = parents_qs.filter(delta)
    parent_links_qs = parent_links_qs.filter(delta)
    students_delta = students_qs.filter(delta)
    weekly_plans_qs = weekly_plans_qs.filter(delta)
    daily_records_qs = daily_records_qs.filter(delta)
    review_records_qs = review_records_qs.filter(delta)
    evaluations_qs = evaluations_qs.filter(delta)
    notifications_qs = notifications_qs.filter(delta)
    courses_qs = courses_qs.filter(delta)
    student_courses_qs = student_courses_qs.filter(delta)
    progress_qs = progress_qs.filter(delta)

    tombstones_qs = pull_tombstones(actor=actor, since=since)

    sync_generation = SyncGeneration.get_current()

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
            "progress": [progress_to_dict(p) for p in progress_qs],
        },
        "tombstones": [tombstone_to_dict(t) for t in tombstones_qs],
        "server_time": now.isoformat(),
        "sync_generation": str(sync_generation),
    }
