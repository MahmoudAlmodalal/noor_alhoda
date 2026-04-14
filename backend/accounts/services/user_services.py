import logging
from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import User, Teacher, Parent
from accounts.utils import normalize_phone
from core.permissions import is_admin_user

logger = logging.getLogger(__name__)


@transaction.atomic
def user_create(*, creator: User, **data) -> User:
    """
    Create a new user. Only admins can create users.
    """
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه إنشاء حسابات جديدة.")

    national_id = str(data.get("national_id", "")).strip()
    if not national_id:
        raise ValidationError({"national_id": "رقم الهوية مطلوب."})

    if User.objects.filter(national_id=national_id).exists():
        raise ValidationError({"national_id": "رقم الهوية مسجل مسبقاً."})

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

    allowed_fields = ["first_name", "last_name", "fcm_token", "specialization", "affiliation", "sheikh_type", "phone_number"]
    if is_admin_user(actor):
        allowed_fields += ["role", "national_id"]

    old_national_id = user.national_id

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
            elif field_name == "sheikh_type" and hasattr(user, "teacher_profile"):
                user.teacher_profile.sheikh_type = value
                user.teacher_profile.save()
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
def teacher_create(*, creator: User, **data) -> Teacher:
    """Create a new teacher (User + Teacher profile)."""
    user = user_create(
        creator=creator,
        national_id=data["national_id"],
        phone_number=data.get("phone_number", ""),
        first_name=data.get("first_name", ""),
        last_name=data.get("last_name", ""),
        role="teacher",
        password=data.get("password"),
    )

    teacher = Teacher.objects.create(
        user=user,
        full_name=data["full_name"],
        specialization=data.get("specialization", ""),
        session_days=data.get("session_days", []),
        max_students=data.get("max_students", 25),
        affiliation=data.get("affiliation", ""),
        sheikh_type=data.get("sheikh_type", ""),
    )
    return teacher
