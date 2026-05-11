"""
Service functions for StudentProgress — create, update, delete.
All mutations are wrapped in @transaction.atomic.
"""
from __future__ import annotations

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from core.permissions import is_admin_user
from progress.constants import SURAH_BY_NUMBER
from progress.models import StudentProgress
from students.models import Student


@transaction.atomic
def progress_create(
    *,
    actor: User,
    student_id,
    surah_number: int,
    juz_number: int,
    note: str = "",
    from_page=None,
    to_page=None,
    id=None,
) -> StudentProgress:
    """Create a new progress entry for a student."""
    # Authorization
    if not (is_admin_user(actor) or actor.role == "teacher"):
        raise PermissionDenied("فقط المحفظون والمدراء يمكنهم تسجيل التقدم.")

    # Validate student
    try:
        student = Student.objects.select_related("teacher").get(id=student_id)
    except Student.DoesNotExist:
        raise ValidationError({"student_id": "الطالب غير موجود."})

    # Teacher scope check
    if actor.role == "teacher":
        if not hasattr(actor, "teacher_profile"):
            raise PermissionDenied("المستخدم ليس محفظاً.")
        if str(student.teacher_id) != str(actor.teacher_profile.id):
            raise PermissionDenied("لا يمكنك تسجيل تقدم طالب ليس من حلقتك.")

    # Validate surah number
    surah_data = SURAH_BY_NUMBER.get(surah_number)
    if not surah_data:
        raise ValidationError({"surah_number": "رقم السورة غير صحيح (1–114)."})

    # Validate juz number
    if not (1 <= juz_number <= 30):
        raise ValidationError({"juz_number": "رقم الجزء غير صحيح (1–30)."})

    # Resolve teacher profile
    teacher = getattr(actor, "teacher_profile", None)

    kwargs = {
        "student": student,
        "teacher": teacher,
        "surah_number": surah_number,
        "surah_name": surah_data["name_ar"],
        "juz_number": juz_number,
        "note": note or "",
    }

    if from_page is not None:
        kwargs["from_page"] = int(from_page)
    if to_page is not None:
        kwargs["to_page"] = int(to_page)
    if id is not None:
        kwargs["id"] = id

    entry = StudentProgress(**kwargs)
    entry.full_clean()
    entry.save()
    return entry


@transaction.atomic
def progress_update(
    *,
    progress: StudentProgress,
    actor: User,
    data: dict,
) -> StudentProgress:
    """Update an existing progress entry."""
    if not (is_admin_user(actor) or actor.role == "teacher"):
        raise PermissionDenied("غير مصرح.")

    if actor.role == "teacher":
        if not hasattr(actor, "teacher_profile"):
            raise PermissionDenied("المستخدم ليس محفظاً.")
        if str(progress.student.teacher_id) != str(actor.teacher_profile.id):
            raise PermissionDenied("لا يمكنك تعديل تقدم طالب ليس من حلقتك.")

    allowed_fields = {"surah_number", "juz_number", "note", "from_page", "to_page"}
    update_fields = []

    for key, value in data.items():
        if key not in allowed_fields:
            continue
        if key == "surah_number":
            surah_data = SURAH_BY_NUMBER.get(int(value))
            if not surah_data:
                raise ValidationError({"surah_number": "رقم السورة غير صحيح."})
            progress.surah_number = int(value)
            progress.surah_name = surah_data["name_ar"]
            update_fields.extend(["surah_number", "surah_name"])
        elif key == "juz_number":
            if not (1 <= int(value) <= 30):
                raise ValidationError({"juz_number": "رقم الجزء غير صحيح."})
            progress.juz_number = int(value)
            update_fields.append("juz_number")
        elif key == "note":
            progress.note = str(value)
            update_fields.append("note")
        elif key == "from_page":
            progress.from_page = int(value) if value is not None else None
            update_fields.append("from_page")
        elif key == "to_page":
            progress.to_page = int(value) if value is not None else None
            update_fields.append("to_page")

    if update_fields:
        update_fields.append("updated_at")
        progress.full_clean()
        progress.save(update_fields=update_fields)

    return progress


@transaction.atomic
def progress_delete(
    *,
    progress: StudentProgress,
    actor: User,
) -> None:
    """Delete a progress entry."""
    if not (is_admin_user(actor) or actor.role == "teacher"):
        raise PermissionDenied("غير مصرح.")

    if actor.role == "teacher":
        if not hasattr(actor, "teacher_profile"):
            raise PermissionDenied("المستخدم ليس محفظاً.")
        if str(progress.student.teacher_id) != str(actor.teacher_profile.id):
            raise PermissionDenied("لا يمكنك حذف تقدم طالب ليس من حلقتك.")

    from sync.services.tombstone_service import tombstone_write
    tombstone_write(
        resource="progress",
        resource_uuid=progress.id,
        deleted_by=actor,
        scope_user_id=actor.id,
    )
    progress.delete()
