import logging
import re

from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import User, Parent
from accounts.utils import normalize_phone
from core.permissions import is_admin_user

logger = logging.getLogger(__name__)

_NATIONAL_ID_RE = re.compile(r"^\d+$")


def _validate_national_id(value: str, *, exclude_pk=None) -> str:
    """Return the normalized national_id or raise a ValidationError."""
    national_id = str(value or "").strip()
    if not national_id:
        raise ValidationError({"national_id": "رقم الهوية مطلوب."})
    if not _NATIONAL_ID_RE.match(national_id):
        raise ValidationError({"national_id": "رقم الهوية يجب أن يحتوي على أرقام فقط."})
    qs = User.objects.filter(national_id=national_id)
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    if qs.exists():
        raise ValidationError({"national_id": "رقم الهوية مسجل مسبقاً."})
    return national_id


@transaction.atomic
def user_create(*, creator: User, **data) -> User:
    """
    Create a new user. Only admins can create users.
    """
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه إنشاء حسابات جديدة.")

    national_id = _validate_national_id(data.get("national_id", ""))

    role = data.get("role", "student")

    if role == "student" and not data.get("_internal_student_create"):
        raise ValidationError(
            {"role": "لإنشاء حساب طالب، استخدم صفحة تسجيل الطلاب."}
        )

    password = data.get("password")
    if not password:
        password = national_id[-4:]
        logger.info("Created %s user %s with default password (last 4 digits of national_id).", role, national_id)

    phone_number = normalize_phone(data.get("phone_number", ""))

    user = User(
        national_id=national_id,
        phone_number=phone_number,
        first_name=data.get("first_name", ""),
        last_name=data.get("last_name", ""),
        role=role,
    )
    user.set_password(password)
    user.full_clean()
    user.save()

    return user


@transaction.atomic
def user_update(*, user: User, actor: User, data: dict) -> User:
    """
    Update user fields. Admin can update anyone. Others can update self only.
    """
    if not is_admin_user(actor) and actor.id != user.id:
        raise PermissionDenied("ليس لديك صلاحية لتعديل هذا المستخدم.")

    allowed_fields = [
        "first_name", "last_name", "fcm_token",
        "specialization", "affiliation", "ring_name", "course_ids",
        "phone_number",
    ]
    if is_admin_user(actor):
        allowed_fields += ["role", "national_id"]

    old_national_id = user.national_id

    if "national_id" in data and is_admin_user(actor):
        data = dict(data)
        data["national_id"] = _validate_national_id(
            data["national_id"], exclude_pk=user.pk
        )

    for field_name, value in data.items():
        if field_name in allowed_fields:
            if field_name == "phone_number":
                value = normalize_phone(value)
                setattr(user, field_name, value)
            elif field_name == "specialization" and hasattr(user, "teacher_profile"):
                user.teacher_profile.specialization = value
                user.teacher_profile.save()
            elif field_name == "affiliation" and hasattr(user, "teacher_profile"):
                user.teacher_profile.affiliation = value
                user.teacher_profile.save()
            elif field_name == "ring_name" and hasattr(user, "teacher_profile"):
                user.teacher_profile.ring_name = value
                user.teacher_profile.save()
            elif field_name == "course_ids" and hasattr(user, "teacher_profile"):
                user.teacher_profile.courses.set(value)
            else:
                setattr(user, field_name, value)

    if "password" in data and (is_admin_user(actor) or actor.id == user.id):
        user.set_password(data["password"])
    elif user.national_id != old_national_id:
        user.set_password(user.national_id[-4:])
        logger.info("Resynced %s user %s password to last 4 digits of new national_id.", user.role, user.national_id)

    user.full_clean()
    user.save()
    return user


@transaction.atomic
def user_delete(*, user: User, actor: User) -> None:
    """Delete a user. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه حذف الحسابات.")
    user.delete()


@transaction.atomic
def parent_create(*, creator: User, id=None, **data) -> Parent:
    """Create a new parent (User + Parent profile). Admin only."""
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه إنشاء حسابات أولياء الأمور.")

    user = user_create(
        creator=creator,
        national_id=data["national_id"],
        phone_number=data.get("phone_number", ""),
        first_name=data.get("first_name", ""),
        last_name=data.get("last_name", ""),
        role="parent",
        password=data.get("password"),
    )

    parent_kwargs = dict(
        user=user,
        full_name=data["full_name"],
        phone_number=normalize_phone(data.get("phone_number", "")),
    )
    if id is not None:
        parent_kwargs["id"] = id

    parent = Parent.objects.create(**parent_kwargs)
    return parent


@transaction.atomic
def parent_update(*, parent: Parent, actor: User, data: dict) -> Parent:
    """Update a parent profile. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه تعديل ولي الأمر.")

    allowed = ["full_name", "phone_number"]
    for field, value in data.items():
        if field in allowed:
            if field == "phone_number":
                value = normalize_phone(value)
            setattr(parent, field, value)

    parent.full_clean()
    parent.save()
    return parent


@transaction.atomic
def parent_delete(*, parent: Parent, actor: User) -> None:
    """Delete a parent profile + their User. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه حذف ولي الأمر.")

    from sync.models import Tombstone
    from sync.services.tombstone_service import tombstone_write

    deleted_uuid = parent.id
    user = parent.user
    user.delete()  # Cascades to parent profile
    tombstone_write(
        resource=Tombstone.Resource.PARENT,
        resource_uuid=deleted_uuid,
        actor=actor,
        scope_user_id=None,
    )
