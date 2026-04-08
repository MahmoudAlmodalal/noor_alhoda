from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from accounts.models import User, Teacher
from core.permissions import is_admin_user


def user_list(*, filters: dict, actor: User) -> QuerySet[User]:
    """
    Return filtered list of users. Only admins can list all users.
    """
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه عرض قائمة المستخدمين.")

    qs = User.objects.all()

    role = filters.get("role")
    if role:
        qs = qs.filter(role=role)

    is_active = filters.get("is_active")
    if is_active is not None:
        qs = qs.filter(is_active=is_active)

    search = filters.get("search")
    if search:
        qs = qs.filter(
            models_Q(first_name__icontains=search)
            | models_Q(last_name__icontains=search)
            | models_Q(phone_number__icontains=search)
        )

    return qs


def user_get(*, user_id, actor: User) -> User:
    """Get a single user by ID. Admin can view anyone, others only self."""
    user = get_object_or_404(User, id=user_id)
    if not is_admin_user(actor) and actor.id != user.id:
        raise PermissionDenied("ليس لديك صلاحية لعرض هذا المستخدم.")
    return user


def teacher_list(*, filters: dict) -> QuerySet[Teacher]:
    """Return filtered list of teachers."""
    qs = Teacher.objects.select_related("user").all()

    search = filters.get("search")
    if search:
        qs = qs.filter(full_name__icontains=search)

    return qs


# Helper to avoid circular import with django.db.models.Q
from django.db.models import Q as models_Q  # noqa: E402
