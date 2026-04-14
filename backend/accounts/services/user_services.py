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

    phone_number = normalize_phone(data.get("phone_number", ""))
    if not phone_number:
        raise ValidationError({"phone_number": "رقم الجوال مطلوب."})

    if User.objects.filter(phone_number=phone_number).exists():
        raise ValidationError({"phone_number": "رقم الجوال مسجل مسبقاً."})

    role = data.get("role", "student")

    # Prevent creating student users directly — use student_create() instead
    # to ensure a Student profile is always created alongside the User.
    if role == "student" and not data.get("_internal_student_create"):
        raise ValidationError(
            {"role": "لإنشاء حساب طالب، استخدم صفحة تسجيل الطلاب."}
        )

    # Default password is the last 4 digits of the phone number
    # This applies to all roles (student, teacher, parent, etc.) during bulk import or if not specified
    password = data.get("password") or phone_number[-4:]
    logger.info("Created %s user %s with password = last 4 digits of phone.", role, phone_number)

    user = User(
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

    allowed_fields = ["first_name", "last_name", "fcm_token", "specialization", "affiliation"]
    if is_admin_user(actor):
        allowed_fields += ["role", "phone_number"]

    old_phone = user.phone_number

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
            else:
                setattr(user, field_name, value)

    if "password" in data and (is_admin_user(actor) or actor.id == user.id):
        user.set_password(data["password"])
    elif user.phone_number != old_phone and user.role in ("student", "teacher"):
        user.set_password(user.phone_number[-4:])
        logger.info("Resynced %s user %s password to last 4 digits of new phone.", user.role, user.phone_number)

    user.full_clean()
    user.save()
    return user


@transaction.atomic
def user_delete(*, user: User, actor: User):
    """Hard-delete a user account. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه حذف الحسابات.")

    user.delete()


@transaction.atomic
def teacher_create(*, creator: User, **data) -> Teacher:
    """
    Create a teacher profile. Creates the User first, then the Teacher profile.
    """
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه إنشاء حسابات المحفظين.")

    user = user_create(
        creator=creator,
        phone_number=data.get("phone_number"),
        first_name=data.get("first_name", ""),
        last_name=data.get("last_name", ""),
        role="teacher",
    )

    teacher = Teacher(
        user=user,
        full_name=data.get("full_name", user.get_full_name()),
        specialization=data.get("specialization", ""),
        affiliation=data.get("affiliation", ""),
        session_days=data.get("session_days", []),
        max_students=data.get("max_students", 25),
    )
    teacher.full_clean()
    teacher.save()

    return teacher
