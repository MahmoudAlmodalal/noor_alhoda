import logging
import secrets

from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from backend.accounts.models import User, Teacher, Parent

logger = logging.getLogger(__name__)


@transaction.atomic
def user_create(*, creator: User, **data) -> User:
    """
    Create a new user. Only admins can create users.
    """
    if creator.role != "admin":
        raise PermissionDenied("فقط المدير يمكنه إنشاء حسابات جديدة.")

    phone_number = data.get("phone_number")
    if not phone_number:
        raise ValidationError({"phone_number": "رقم الجوال مطلوب."})

    if User.objects.filter(phone_number=phone_number).exists():
        raise ValidationError({"phone_number": "رقم الجوال مسجل مسبقاً."})

    role = data.get("role", "student")
    password = data.get("password") or secrets.token_urlsafe(8)
    logger.info("Created user %s with auto-generated password (communicate via SMS).", phone_number)

    user = User(
        phone_number=phone_number,
        username=data.get("username", phone_number),
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
    if actor.role != "admin" and actor.id != user.id:
        raise PermissionDenied("ليس لديك صلاحية لتعديل هذا المستخدم.")

    allowed_fields = ["first_name", "last_name", "fcm_token"]
    if actor.role == "admin":
        allowed_fields += ["role", "is_active", "phone_number"]

    for field_name, value in data.items():
        if field_name in allowed_fields:
            setattr(user, field_name, value)

    if "password" in data and (actor.role == "admin" or actor.id == user.id):
        user.set_password(data["password"])

    user.full_clean()
    user.save()
    return user


@transaction.atomic
def user_deactivate(*, user: User, actor: User) -> User:
    """Soft-delete a user account. Admin only."""
    if actor.role != "admin":
        raise PermissionDenied("فقط المدير يمكنه تعطيل الحسابات.")

    user.is_active = False
    user.save()
    return user


@transaction.atomic
def teacher_create(*, creator: User, **data) -> Teacher:
    """
    Create a teacher profile. Creates the User first, then the Teacher profile.
    """
    if creator.role != "admin":
        raise PermissionDenied("فقط المدير يمكنه إنشاء حسابات المحفظين.")

    user = user_create(
        creator=creator,
        phone_number=data.get("phone_number"),
        username=data.get("username", data.get("phone_number", "")),
        first_name=data.get("first_name", ""),
        last_name=data.get("last_name", ""),
        password=data.get("password"),
        role="teacher",
    )

    teacher = Teacher(
        user=user,
        full_name=data.get("full_name", user.get_full_name()),
        specialization=data.get("specialization", ""),
        session_days=data.get("session_days", []),
        max_students=data.get("max_students", 25),
    )
    teacher.full_clean()
    teacher.save()

    return teacher
