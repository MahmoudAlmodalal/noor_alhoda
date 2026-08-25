"""
Sync pull service. Returns the delta of records the actor can see since a
given timestamp, plus tombstones for rows that were hard-deleted in the
same window.

RBAC is enforced by composing existing selectors — never by hand-rolling
"what can this user see" here.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from accounts.models import ParentStudentLink, User
from students.models import Student
from sync.models import SyncGeneration
from sync.selectors.pull_selectors import (
    delta_or_backfill_q,
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

    # Students whose *relationship to this actor* changed since the last sync.
    # Their existing child rows are older than the client's cursor, so a plain
    # delta would never ship them — see `delta_or_backfill_q`.
    backfill_student_ids = _newly_visible_student_ids(
        actor=actor,
        since=since,
        students_qs=students_qs,
        visible_student_ids=visible_student_ids,
    )

    users_qs = users_qs.filter(delta)
    # A student who just moved rings needs their *new* teacher's row, whose
    # `updated_at` is untouched by the move and would fail the delta — the
    # client would render a plan with no teacher name.
    if backfill_student_ids:
        backfill_teacher_ids = list(
            Student.objects.filter(id__in=backfill_student_ids)
            .exclude(teacher__isnull=True)
            .values_list("teacher_id", flat=True)
        )
        teachers_qs = teachers_qs.filter(delta | Q(id__in=backfill_teacher_ids))
    else:
        teachers_qs = teachers_qs.filter(delta)
    parents_qs = parents_qs.filter(delta)
    parent_links_qs = parent_links_qs.filter(delta)
    students_delta_qs = students_qs.filter(delta)
    # A student's national_id is stored on User, while the local students
    # table also mirrors it for offline search/login UX. Re-emit the student
    # row whenever its related User changed so every client receives the new
    # identity number in the same pull cycle.
    changed_user_ids = users_qs.values_list("id", flat=True)
    changed_student_ids = students_qs.filter(user_id__in=changed_user_ids).values_list("id", flat=True)
    students_delta = list(students_delta_qs)
    existing_student_ids = {row.id for row in students_delta}
    students_delta.extend(
        row for row in students_qs.filter(id__in=changed_student_ids)
        if row.id not in existing_student_ids
    )

    def _student_scoped(student_field: str) -> Q:
        return delta_or_backfill_q(
            delta=delta,
            student_field=student_field,
            visible_student_ids=visible_student_ids,
            backfill_student_ids=backfill_student_ids,
        )

    weekly_plans_qs = weekly_plans_qs.filter(_student_scoped("student_id"))
    # DailyRecord reaches its student either directly or through its plan, so a
    # backfill has to consider both paths (mirrors `pull_daily_records_for_students`).
    daily_records_qs = daily_records_qs.filter(
        _student_scoped("student_id") | _student_scoped("weekly_plan__student_id")
    ).distinct()
    review_records_qs = review_records_qs.filter(_student_scoped("student_id"))
    evaluations_qs = evaluations_qs.filter(_student_scoped("student_id"))
    notifications_qs = notifications_qs.filter(delta)
    courses_qs = courses_qs.filter(delta)
    student_courses_qs = student_courses_qs.filter(_student_scoped("student_id"))
    progress_qs = progress_qs.filter(_student_scoped("student_id"))

    tombstones_qs = pull_tombstones(actor=actor, since=since)

    # -----------------------------------------------------------------------
    # "Evicted students" — students who LEFT this teacher's ring since the
    # last sync.  Without this, a delta pull for a teacher never returns the
    # updated row (teacher=None) for a student who was just unassigned,
    # because `pull_visible_students` scopes to teacher=actor exclusively.
    # The result: stale rows stay in the client IndexedDB forever, the
    # student keeps showing in the teacher's list, and any new change-request
    # for that student is rejected with "not in your ring".
    #
    # Fix: for teacher actors on a delta pull, also include students whose
    # `updated_at > since` AND whose teacher FK no longer points to this
    # teacher (i.e. they were recently unassigned or transferred).
    # The client receives the updated row (teacher_id = null / other teacher)
    # and upserts it, clearing the stale local entry.
    # -----------------------------------------------------------------------
    if since is not None and actor.role == "teacher" and hasattr(actor, "teacher_profile"):
        evicted_qs = (
            Student.objects
            .filter(delta)
            .exclude(id__in=visible_student_ids)
            .exclude(id__in=[row.id for row in students_delta])
            .filter(
                change_requests__teacher_id=actor.teacher_profile.id,
                change_requests__action="unassign",
                change_requests__status="approved",
            )
            .select_related("user", "teacher")
            .distinct()
        )
        students_delta = list(students_delta) + list(evicted_qs)
    # -----------------------------------------------------------------------

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
        # Hand back a watermark that lags `now`, never `now` itself. See
        # SYNC_PULL_OVERLAP_SECONDS in settings/base.py: a row stamped before
        # this snapshot but committed after it is invisible here, and a cursor
        # at `now` would skip it forever. The overlap re-ships a small window
        # each pull; every client-side upsert is keyed by id and idempotent.
        "server_time": (
            now - timedelta(seconds=settings.SYNC_PULL_OVERLAP_SECONDS)
        ).isoformat(),
        "sync_generation": str(sync_generation),
    }


def _newly_visible_student_ids(
    *,
    actor: User,
    since: datetime | None,
    students_qs,
    visible_student_ids: list,
) -> list:
    """Students that entered this actor's scope since `since`.

    A full pull (`since is None`) already ships everything, so there is nothing
    to backfill. Otherwise the signal differs per role:

    * teacher — the student row itself is touched when the teacher FK is set or
      transferred, so a visible student with a fresh `updated_at` is either new
      to the ring or was just edited. Backfilling the latter costs one extra
      delta-free read of rows the client usually already has; missing the
      former loses the student's entire history.
    * parent  — the `ParentStudentLink` row carries the change.
    * student — their own row moving means an admin re-assigned or re-enrolled
      them; re-read their history rather than trusting the cursor.
    """
    if since is None or not visible_student_ids:
        return []

    if actor.role == "teacher":
        return list(
            students_qs.filter(updated_at__gt=since).values_list("id", flat=True)
        )

    if actor.role == "parent":
        return list(
            ParentStudentLink.objects.filter(
                parent__user=actor,
                student_id__in=visible_student_ids,
                updated_at__gt=since,
            ).values_list("student_id", flat=True)
        )

    if actor.role == "student":
        return list(
            students_qs.filter(updated_at__gt=since).values_list("id", flat=True)
        )

    return []
