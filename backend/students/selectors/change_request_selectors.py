from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from accounts.models import User
from core.permissions import is_admin_user
from students.models import StudentChangeRequest


def can_access_change_request(*, actor: User, req: StudentChangeRequest) -> bool:
    """RBAC check for a StudentChangeRequest: admin — full; teacher — own only."""
    if is_admin_user(actor):
        return True
    if actor.role == "teacher":
        return hasattr(actor, "teacher_profile") and req.teacher_id == actor.teacher_profile.id
    return False


def change_request_list(*, filters: dict, user: User) -> QuerySet[StudentChangeRequest]:
    """Row-scoped list of StudentChangeRequests: admin sees all, teacher sees own."""
    qs = StudentChangeRequest.objects.select_related(
        "teacher", "student", "requested_by", "reviewed_by"
    ).all()

    if is_admin_user(user):
        pass
    elif user.role == "teacher" and hasattr(user, "teacher_profile"):
        qs = qs.filter(teacher=user.teacher_profile)
    else:
        return qs.none()

    status = filters.get("status")
    if status:
        qs = qs.filter(status=status)

    action = filters.get("action")
    if action:
        qs = qs.filter(action=action)

    return qs


def change_request_get(*, request_id, actor: User) -> StudentChangeRequest:
    req = get_object_or_404(
        StudentChangeRequest.objects.select_related("teacher", "student", "requested_by", "reviewed_by"),
        id=request_id,
    )
    if not can_access_change_request(actor=actor, req=req):
        raise PermissionDenied("ليس لديك صلاحية لعرض هذا الطلب.")
    return req
