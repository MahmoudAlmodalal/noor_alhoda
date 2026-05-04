from django.db import transaction
from rest_framework.exceptions import PermissionDenied

from accounts.models import User
from accounts.services.user_services import user_create, user_update
from core.permissions import is_admin_user
from teacher.models import Teacher


_USER_FIELDS = {"first_name", "last_name", "phone_number", "national_id"}


@transaction.atomic
def teacher_create(*, creator: User, id=None, user_id=None, **data) -> Teacher:
    """Create a new teacher (User + Teacher profile).

    `user_id` is optional; the offline client mints a UUID for the user
    so the local users row exists at the right key before sync.
    """
    user = user_create(
        creator=creator,
        id=user_id,
        national_id=data["national_id"],
        phone_number=data.get("phone_number", ""),
        first_name=data.get("first_name", ""),
        last_name=data.get("last_name", ""),
        role="teacher",
        password=data.get("password"),
    )

    teacher_kwargs = dict(
        user=user,
        full_name=data["full_name"],
        specialization=data.get("specialization", ""),
        session_days=data.get("session_days", []),
        max_students=data.get("max_students", 25),
        affiliation=data.get("affiliation", ""),
        ring_name=data.get("ring_name", ""),
    )
    if id is not None:
        teacher_kwargs["id"] = id

    teacher = Teacher.objects.create(**teacher_kwargs)

    course_ids = data.get("course_ids") or []
    if course_ids:
        teacher.courses.set(course_ids)

    return teacher


@transaction.atomic
def teacher_update(*, teacher: Teacher, actor: User, data: dict) -> Teacher:
    """Update a teacher profile. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه تعديل المحفظ.")

    # national_id / phone_number / first_name / last_name live on the related
    # User (USERNAME_FIELD). Delegate to user_update so we reuse its admin
    # allowlist, uniqueness/numeric validation, and password re-sync when
    # national_id changes.
    user_fields = {k: v for k, v in data.items() if k in _USER_FIELDS}
    if user_fields:
        user_update(user=teacher.user, actor=actor, data=user_fields)

    allowed = [
        "full_name", "specialization", "session_days",
        "max_students", "affiliation", "ring_name",
    ]
    for field, value in data.items():
        if field in allowed:
            setattr(teacher, field, value)

    course_ids = data.get("course_ids")
    if course_ids is not None:
        teacher.courses.set(course_ids)

    teacher.full_clean()
    teacher.save()
    return teacher


@transaction.atomic
def teacher_delete(*, teacher: Teacher, actor: User) -> None:
    """Delete a teacher profile + their User. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه حذف المحفظ.")

    from sync.models import Tombstone
    from sync.services.tombstone_service import tombstone_write

    deleted_uuid = teacher.id
    user = teacher.user
    user.delete()  # Cascades to teacher profile
    tombstone_write(
        resource=Tombstone.Resource.TEACHER,
        resource_uuid=deleted_uuid,
        actor=actor,
        scope_user_id=None,
    )
