"""
Sync push service. Accepts a batch of outbox operations from an offline
client, applies them with last-write-wins conflict resolution, and returns
a per-op result so the client can mark each op as synced/conflict/error.

RBAC is delegated to the existing services (`*_create`, `*_update`,
`*_delete`) which raise `PermissionDenied` on unauthorized writes.

Idempotency: every op carries a client-minted `client_id` (UUID). The first
successful application is cached in `IdempotencyKey.result_json`; a replay
with the same `client_id` returns the cached result instead of re-running
the mutation.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import ParentStudentLink, Parent, User
from teacher.models import Teacher
from courses.models import Course, StudentCourse
from evaluations.models import Evaluation
from notifications.models import Notification
from records.models import DailyRecord, ReviewRecord, WeeklyPlan
from students.models import Student
from progress.models import StudentProgress
from sync.models import IdempotencyKey, Tombstone
from sync.selectors.idempotency_selectors import idempotency_get
from sync.services.resource_dicts import RESOURCE_DICT_MAP
from sync.services.tombstone_service import tombstone_write

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------

def sync_push(*, actor: User, ops: list[dict]) -> dict[str, Any]:
    """
    Apply a list of outbox operations for the authenticated actor.

    Each op has: `client_id`, `resource`, `op` (create/update/delete),
    `id` (target UUID), `data` (for create/update), `base_updated_at`
    (for LWW on update/delete).

    Returns:
        {"results": [per-op result, ...], "server_time": <iso>}
    """
    results: list[dict[str, Any]] = []
    for op in ops:
        result = _apply_op(actor=actor, op=op)
        results.append(result)

    return {
        "results": results,
        "server_time": timezone.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# Per-op dispatch
# ---------------------------------------------------------------------------

def _apply_op(*, actor: User, op: dict) -> dict[str, Any]:
    """Dispatch a single op with idempotency, savepoint, and error shaping."""
    client_id = op.get("client_id")

    # 1. Idempotency — replayed op returns the cached result.
    if client_id:
        cached = idempotency_get(op_id=client_id, user=actor)
        if cached is not None:
            return cached.result_json

    resource = op.get("resource")
    action = op.get("op")

    if resource not in RESOURCE_DICT_MAP and resource != "notification":
        return _finalize(
            client_id=client_id,
            actor=actor,
            resource=resource or "",
            action=action or "",
            result={
                "client_id": client_id,
                "status": "error",
                "error": {"code": "bad_request", "message": "نوع السجل غير معروف."},
            },
        )

    handler = _DISPATCH.get((resource, action))
    if handler is None:
        return _finalize(
            client_id=client_id,
            actor=actor,
            resource=resource,
            action=action,
            result={
                "client_id": client_id,
                "status": "error",
                "error": {"code": "bad_request", "message": "إجراء غير مدعوم."},
            },
        )

    # 2. Wrap the handler in a per-op savepoint so an error on one op
    #    doesn't torpedo the whole batch.
    try:
        with transaction.atomic():
            result = handler(actor=actor, op=op)
    except PermissionDenied as exc:
        result = {
            "client_id": client_id,
            "status": "error",
            "error": {"code": "forbidden", "message": str(exc) or "غير مصرح."},
        }
    except ValidationError as exc:
        result = {
            "client_id": client_id,
            "status": "error",
            "error": {
                "code": "validation",
                "message": _first_validation_message(exc) or "بيانات غير صالحة.",
                "detail": getattr(exc, "detail", None),
            },
        }
    except DjangoValidationError as exc:
        result = {
            "client_id": client_id,
            "status": "error",
            "error": {
                "code": "validation",
                "message": "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc),
            },
        }
    except IntegrityError as exc:
        # Unique-together collision on create — caller may have already
        # turned this into a conflict. Otherwise surface as error.
        result = {
            "client_id": client_id,
            "status": "error",
            "error": {"code": "integrity", "message": "تعارض في البيانات (قيم مكررة)."},
        }
        logger.warning("IntegrityError in sync_push op %s/%s: %s", resource, action, exc)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in sync_push op %s/%s", resource, action)
        result = {
            "client_id": client_id,
            "status": "error",
            "error": {"code": "internal", "message": "تعذّر تنفيذ العملية."},
        }

    return _finalize(
        client_id=client_id,
        actor=actor,
        resource=resource,
        action=action,
        result=result,
    )


def _finalize(*, client_id, actor, resource, action, result) -> dict:
    """Cache the result for idempotent replay, then return it."""
    if client_id and result.get("status") in ("synced", "conflict", "error"):
        IdempotencyKey.objects.update_or_create(
            op_id=client_id,
            user=actor,
            defaults={
                "resource": resource,
                "action": action,
                "status": result.get("status"),
                "result_json": result,
            },
        )
    return result


def _first_validation_message(exc: ValidationError) -> str | None:
    """Flatten DRF ValidationError detail to a single Arabic message."""
    detail = getattr(exc, "detail", None)
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list) and detail:
        return str(detail[0])
    if isinstance(detail, dict) and detail:
        first_val = next(iter(detail.values()))
        if isinstance(first_val, list) and first_val:
            return str(first_val[0])
        return str(first_val)
    return None


# ---------------------------------------------------------------------------
# LWW helpers
# ---------------------------------------------------------------------------

def _parse_base(raw: str | None) -> datetime | None:
    if not raw:
        return None
    return parse_datetime(raw)


def _server_newer_than_client(server_updated_at, base_updated_at) -> bool:
    """LWW check: True if server's row was modified AFTER the client's base."""
    if base_updated_at is None:
        # Client didn't know about any base version — treat as conflict
        # so the server's row always wins over blind update/delete.
        return True
    if server_updated_at is None:
        return False
    return server_updated_at > base_updated_at


def _conflict_row(resource: str, instance) -> dict:
    """Serialize a server row for a push response (synced or conflict).

    The `_resource` tag lets the frontend dispatch the row to the correct
    local table without shape-guessing (see `frontend/src/lib/sync/push.ts`
    `applyServerRow`) and emits the right change event so UIs refresh.
    """
    _model, to_dict = RESOURCE_DICT_MAP[resource]
    row = to_dict(instance)
    row["_resource"] = resource
    return row


# ---------------------------------------------------------------------------
# Per-resource handlers
# ---------------------------------------------------------------------------

def _push_student_create(*, actor: User, op: dict) -> dict:
    from students.services.student_services import student_create

    data = dict(op.get("data") or {})
    data["id"] = op.get("id")
    student = student_create(creator=actor, **data)
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": RESOURCE_DICT_MAP["student"][1](student),
    }


def _push_student_update(*, actor: User, op: dict) -> dict:
    from students.selectors.student_selectors import student_get
    from students.services.student_services import student_update

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    student = student_get(student_id=target_id, actor=actor)
    if _server_newer_than_client(student.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("student", student),
        }
    updated = student_update(student=student, actor=actor, data=op.get("data") or {})
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("student", updated),
    }


def _push_student_delete(*, actor: User, op: dict) -> dict:
    from students.selectors.student_selectors import student_get
    from students.services.student_services import student_delete

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    student = student_get(student_id=target_id, actor=actor)
    if _server_newer_than_client(student.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("student", student),
        }
    student_delete(student_id=target_id, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


def _push_weekly_plan_create(*, actor: User, op: dict) -> dict:
    from records.services.record_services import weekly_plan_create

    data = dict(op.get("data") or {})
    # weekly_plan_create expects student_id, week_start, week_number, total_required, teacher
    try:
        plan = weekly_plan_create(
            id=op.get("id"),
            student_id=data.get("student_id"),
            week_start=data.get("week_start"),
            week_number=data.get("week_number"),
            total_required=data.get("total_required", 0),
            teacher=actor,
        )
    except IntegrityError:
        # Unique-together (student, week_start) collision — return server row.
        existing = WeeklyPlan.objects.filter(
            student_id=data.get("student_id"),
            week_start=data.get("week_start"),
        ).first()
        if existing is not None:
            return {
                "client_id": op.get("client_id"),
                "status": "conflict",
                "row": _conflict_row("weekly_plan", existing),
            }
        raise
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("weekly_plan", plan),
    }


def _push_weekly_plan_update(*, actor: User, op: dict) -> dict:
    from records.services.record_services import weekly_plan_update

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    plan = WeeklyPlan.objects.filter(id=target_id).first()
    if plan is None:
        return {
            "client_id": op.get("client_id"),
            "status": "error",
            "error": {"code": "not_found", "message": "الخطة غير موجودة."},
        }
    if _server_newer_than_client(plan.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("weekly_plan", plan),
        }
    updated = weekly_plan_update(plan=plan, actor=actor, data=op.get("data") or {})
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("weekly_plan", updated),
    }


def _push_weekly_plan_delete(*, actor: User, op: dict) -> dict:
    from records.services.record_services import weekly_plan_delete

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    plan = WeeklyPlan.objects.filter(id=target_id).first()
    if plan is None:
        return {"client_id": op.get("client_id"), "status": "synced"}
    if _server_newer_than_client(plan.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("weekly_plan", plan),
        }
    weekly_plan_delete(plan=plan, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


def _push_daily_record_create(*, actor: User, op: dict) -> dict:
    from records.services.record_services import daily_record_create

    data = dict(op.get("data") or {})
    try:
        record = daily_record_create(
            id=op.get("id"),
            teacher=actor,
            **data,
        )
    except IntegrityError:
        existing = DailyRecord.objects.filter(
            weekly_plan_id=data.get("weekly_plan_id"),
            day=data.get("day"),
        ).first()
        if existing is not None:
            return {
                "client_id": op.get("client_id"),
                "status": "conflict",
                "row": _conflict_row("daily_record", existing),
            }
        raise
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("daily_record", record),
    }


def _push_daily_record_update(*, actor: User, op: dict) -> dict:
    from records.services.record_services import daily_record_update

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    record = DailyRecord.objects.filter(id=target_id).first()
    if record is None:
        return {
            "client_id": op.get("client_id"),
            "status": "error",
            "error": {"code": "not_found", "message": "السجل اليومي غير موجود."},
        }
    if _server_newer_than_client(record.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("daily_record", record),
        }
    updated = daily_record_update(
        record_id=target_id,
        teacher=actor,
        data=op.get("data") or {},
    )
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("daily_record", updated),
    }


def _push_daily_record_delete(*, actor: User, op: dict) -> dict:
    from records.services.record_services import daily_record_delete

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    record = DailyRecord.objects.filter(id=target_id).first()
    if record is None:
        return {"client_id": op.get("client_id"), "status": "synced"}
    if _server_newer_than_client(record.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("daily_record", record),
        }
    daily_record_delete(record=record, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


def _push_review_record_create(*, actor: User, op: dict) -> dict:
    from records.services.review_services import review_record_create

    data = dict(op.get("data") or {})
    # op.data carries an `id` copy from the frontend (mutations.ts:502).
    # Overwrite with the authoritative target_id and splat once to avoid
    # `got multiple values for keyword argument 'id'`.
    data["id"] = op.get("id")
    record = review_record_create(actor=actor, **data)
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("review_record", record),
    }


def _push_review_record_update(*, actor: User, op: dict) -> dict:
    from records.services.review_services import review_record_update

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    record = ReviewRecord.objects.filter(id=target_id).first()
    if record is None:
        return {
            "client_id": op.get("client_id"),
            "status": "error",
            "error": {"code": "not_found", "message": "سجل المراجعة غير موجود."},
        }
    if _server_newer_than_client(record.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("review_record", record),
        }
    updated = review_record_update(record=record, actor=actor, data=op.get("data") or {})
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("review_record", updated),
    }


def _push_review_record_delete(*, actor: User, op: dict) -> dict:
    from records.services.review_services import review_record_delete

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    record = ReviewRecord.objects.filter(id=target_id).first()
    if record is None:
        return {"client_id": op.get("client_id"), "status": "synced"}
    if _server_newer_than_client(record.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("review_record", record),
        }
    review_record_delete(record=record, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


def _push_evaluation_create(*, actor: User, op: dict) -> dict:
    from evaluations.services.evaluation_services import evaluation_create

    data = dict(op.get("data") or {})
    data["id"] = op.get("id")
    ev = evaluation_create(actor=actor, **data)
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("evaluation", ev),
    }


def _push_evaluation_update(*, actor: User, op: dict) -> dict:
    from evaluations.services.evaluation_services import evaluation_update

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    ev = Evaluation.objects.filter(id=target_id).first()
    if ev is None:
        return {
            "client_id": op.get("client_id"),
            "status": "error",
            "error": {"code": "not_found", "message": "الاختبار غير موجود."},
        }
    if _server_newer_than_client(ev.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("evaluation", ev),
        }
    updated = evaluation_update(evaluation=ev, actor=actor, data=op.get("data") or {})
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("evaluation", updated),
    }


def _push_evaluation_delete(*, actor: User, op: dict) -> dict:
    from evaluations.services.evaluation_services import evaluation_delete

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    ev = Evaluation.objects.filter(id=target_id).first()
    if ev is None:
        return {"client_id": op.get("client_id"), "status": "synced"}
    if _server_newer_than_client(ev.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("evaluation", ev),
        }
    evaluation_delete(evaluation=ev, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


def _push_teacher_create(*, actor: User, op: dict) -> dict:
    from teacher.services.teacher_services import teacher_create

    data = dict(op.get("data") or {})
    data["id"] = op.get("id")
    teacher = teacher_create(creator=actor, **data)
    # Hand the freshly-minted user row back to the client in the same
    # response so phone_number/national_id show up on the teachers list
    # without waiting for the next pull heartbeat.
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("teacher", teacher),
        "extra_rows": [_conflict_row("user", teacher.user)],
    }


def _push_teacher_update(*, actor: User, op: dict) -> dict:
    from teacher.services.teacher_services import teacher_update

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    teacher = Teacher.objects.filter(id=target_id).first()
    if teacher is None:
        return {
            "client_id": op.get("client_id"),
            "status": "error",
            "error": {"code": "not_found", "message": "المحفظ غير موجود."},
        }
    if _server_newer_than_client(teacher.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("teacher", teacher),
        }
    updated = teacher_update(teacher=teacher, actor=actor, data=op.get("data") or {})
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("teacher", updated),
        # Mirror create: hand back the user row so phone_number/national_id
        # land on the client without waiting for the next pull.
        "extra_rows": [_conflict_row("user", updated.user)],
    }


def _push_teacher_delete(*, actor: User, op: dict) -> dict:
    from teacher.services.teacher_services import teacher_delete

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    teacher = Teacher.objects.filter(id=target_id).first()
    if teacher is None:
        return {"client_id": op.get("client_id"), "status": "synced"}
    if _server_newer_than_client(teacher.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("teacher", teacher),
        }
    teacher_delete(teacher=teacher, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


def _push_parent_create(*, actor: User, op: dict) -> dict:
    from accounts.services.user_services import parent_create

    data = dict(op.get("data") or {})
    data["id"] = op.get("id")
    parent = parent_create(creator=actor, **data)
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("parent", parent),
    }


def _push_parent_update(*, actor: User, op: dict) -> dict:
    from accounts.services.user_services import parent_update

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    parent = Parent.objects.filter(id=target_id).first()
    if parent is None:
        return {
            "client_id": op.get("client_id"),
            "status": "error",
            "error": {"code": "not_found", "message": "ولي الأمر غير موجود."},
        }
    if _server_newer_than_client(parent.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("parent", parent),
        }
    updated = parent_update(parent=parent, actor=actor, data=op.get("data") or {})
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("parent", updated),
    }


def _push_parent_delete(*, actor: User, op: dict) -> dict:
    from accounts.services.user_services import parent_delete

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    parent = Parent.objects.filter(id=target_id).first()
    if parent is None:
        return {"client_id": op.get("client_id"), "status": "synced"}
    if _server_newer_than_client(parent.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("parent", parent),
        }
    parent_delete(parent=parent, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


def _push_parent_student_link_create(*, actor: User, op: dict) -> dict:
    from students.services.student_services import student_link_parent

    data = dict(op.get("data") or {})
    link = student_link_parent(
        id=op.get("id"),
        student_id=data.get("student_id"),
        parent_id=data.get("parent_id"),
        actor=actor,
    )
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("parent_student_link", link),
    }


def _push_parent_student_link_delete(*, actor: User, op: dict) -> dict:
    from students.services.student_services import student_unlink_parent

    target_id = op.get("id")
    link = ParentStudentLink.objects.filter(id=target_id).first()
    if link is None:
        return {"client_id": op.get("client_id"), "status": "synced"}
    student_unlink_parent(link=link, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


def _push_course_create(*, actor: User, op: dict) -> dict:
    from courses.services.course_services import course_create

    data = dict(op.get("data") or {})
    data["id"] = op.get("id")
    course = course_create(actor=actor, **data)
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("course", course),
    }


def _push_course_update(*, actor: User, op: dict) -> dict:
    from courses.services.course_services import course_update

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    course = Course.objects.filter(id=target_id).first()
    if course is None:
        return {
            "client_id": op.get("client_id"),
            "status": "error",
            "error": {"code": "not_found", "message": "الدورة غير موجودة."},
        }
    if _server_newer_than_client(course.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("course", course),
        }
    updated = course_update(course=course, actor=actor, data=op.get("data") or {})
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("course", updated),
    }


def _push_course_delete(*, actor: User, op: dict) -> dict:
    from courses.services.course_services import course_delete

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    course = Course.objects.filter(id=target_id).first()
    if course is None:
        return {"client_id": op.get("client_id"), "status": "synced"}
    if _server_newer_than_client(course.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("course", course),
        }
    course_delete(course=course, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


def _push_student_course_create(*, actor: User, op: dict) -> dict:
    from courses.services.course_services import student_course_set

    data = dict(op.get("data") or {})
    sc = student_course_set(
        id=op.get("id"),
        actor=actor,
        student_id=data.get("student_id"),
        course_id=data.get("course_id"),
        is_completed=data.get("is_completed", False),
        completion_date=data.get("completion_date"),
    )
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("student_course", sc),
    }


def _push_student_course_update(*, actor: User, op: dict) -> dict:
    from courses.services.course_services import student_course_update

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    sc = StudentCourse.objects.filter(id=target_id).first()
    if sc is None:
        return {
            "client_id": op.get("client_id"),
            "status": "error",
            "error": {"code": "not_found", "message": "التسجيل غير موجود."},
        }
    if _server_newer_than_client(sc.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("student_course", sc),
        }
    updated = student_course_update(enrollment=sc, actor=actor, data=op.get("data") or {})
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("student_course", updated),
    }


def _push_student_course_delete(*, actor: User, op: dict) -> dict:
    from courses.services.course_services import student_course_delete

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    sc = StudentCourse.objects.filter(id=target_id).first()
    if sc is None:
        return {"client_id": op.get("client_id"), "status": "synced"}
    if _server_newer_than_client(sc.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("student_course", sc),
        }
    student_course_delete(enrollment=sc, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


def _push_notification_update(*, actor: User, op: dict) -> dict:
    """
    Only path currently supported: mark-read (and optionally mark-unread).
    """
    target_id = op.get("id")
    notif = Notification.objects.filter(id=target_id, recipient=actor).first()
    if notif is None:
        return {
            "client_id": op.get("client_id"),
            "status": "error",
            "error": {"code": "not_found", "message": "الإشعار غير موجود."},
        }
    data = op.get("data") or {}
    if "is_read" in data:
        notif.is_read = bool(data["is_read"])
        notif.save(update_fields=["is_read", "updated_at"])
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("notification", notif),
    }


def _push_progress_create(*, actor: User, op: dict) -> dict:
    from progress.services.progress_services import progress_create

    data = dict(op.get("data") or {})
    entry = progress_create(
        id=op.get("id"),
        actor=actor,
        student_id=data.get("student_id"),
        surah_number=int(data.get("surah_number", 1)),
        juz_number=int(data.get("juz_number", 1)),
        note=data.get("note", ""),
        from_ayah=data.get("from_ayah"),
        to_ayah=data.get("to_ayah"),
        type=data.get("type", "memorization"),
    )
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("progress", entry),
    }


def _push_progress_update(*, actor: User, op: dict) -> dict:
    from progress.services.progress_services import progress_update

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    entry = StudentProgress.objects.select_related("student").filter(id=target_id).first()
    if entry is None:
        return {
            "client_id": op.get("client_id"),
            "status": "error",
            "error": {"code": "not_found", "message": "سجل التقدم غير موجود."},
        }
    if _server_newer_than_client(entry.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("progress", entry),
        }
    updated = progress_update(progress=entry, actor=actor, data=op.get("data") or {})
    return {
        "client_id": op.get("client_id"),
        "status": "synced",
        "row": _conflict_row("progress", updated),
    }


def _push_progress_delete(*, actor: User, op: dict) -> dict:
    from progress.services.progress_services import progress_delete

    target_id = op.get("id")
    base = _parse_base(op.get("base_updated_at"))
    entry = StudentProgress.objects.select_related("student").filter(id=target_id).first()
    if entry is None:
        return {"client_id": op.get("client_id"), "status": "synced"}
    if _server_newer_than_client(entry.updated_at, base):
        return {
            "client_id": op.get("client_id"),
            "status": "conflict",
            "row": _conflict_row("progress", entry),
        }
    progress_delete(progress=entry, actor=actor)
    return {"client_id": op.get("client_id"), "status": "synced"}


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

_DISPATCH: dict[tuple[str, str], Any] = {
    ("student", "create"): _push_student_create,
    ("student", "update"): _push_student_update,
    ("student", "delete"): _push_student_delete,
    ("teacher", "create"): _push_teacher_create,
    ("teacher", "update"): _push_teacher_update,
    ("teacher", "delete"): _push_teacher_delete,
    ("parent", "create"): _push_parent_create,
    ("parent", "update"): _push_parent_update,
    ("parent", "delete"): _push_parent_delete,
    ("parent_student_link", "create"): _push_parent_student_link_create,
    ("parent_student_link", "delete"): _push_parent_student_link_delete,
    ("weekly_plan", "create"): _push_weekly_plan_create,
    ("weekly_plan", "update"): _push_weekly_plan_update,
    ("weekly_plan", "delete"): _push_weekly_plan_delete,
    ("daily_record", "create"): _push_daily_record_create,
    ("daily_record", "update"): _push_daily_record_update,
    ("daily_record", "delete"): _push_daily_record_delete,
    ("review_record", "create"): _push_review_record_create,
    ("review_record", "update"): _push_review_record_update,
    ("review_record", "delete"): _push_review_record_delete,
    ("evaluation", "create"): _push_evaluation_create,
    ("evaluation", "update"): _push_evaluation_update,
    ("evaluation", "delete"): _push_evaluation_delete,
    ("course", "create"): _push_course_create,
    ("course", "update"): _push_course_update,
    ("course", "delete"): _push_course_delete,
    ("student_course", "create"): _push_student_course_create,
    ("student_course", "update"): _push_student_course_update,
    ("student_course", "delete"): _push_student_course_delete,
    ("notification", "update"): _push_notification_update,
    ("progress", "create"): _push_progress_create,
    ("progress", "update"): _push_progress_update,
    ("progress", "delete"): _push_progress_delete,
}
