from datetime import date as date_cls

from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import User
from core.permissions import is_admin_user
from records.models import ReviewRecord
from students.models import Student


@transaction.atomic
def review_record_create(
    *,
    student_id,
    surah_name: str,
    reviewed_date: date_cls | None = None,
    quality: str = "acceptable",
    note: str = "",
    actor: User,
    id=None,
) -> ReviewRecord:
    """Create or upsert a review record. Allowed: student-self, teacher-of-student, admin."""
    if not surah_name or not str(surah_name).strip():
        raise ValidationError({"surah_name": "اسم السورة مطلوب."})

    try:
        student = Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        raise ValidationError({"student_id": "الطالب غير موجود."})

    # Permission check: admin, teacher-of-student, or student-self.
    if not is_admin_user(actor):
        if actor.role == "teacher":
            if not hasattr(actor, "teacher_profile") or student.teacher_id != actor.teacher_profile.id:
                raise PermissionDenied("لا يمكنك التسجيل لطالب ليس في حلقتك.")
        elif actor.role == "student":
            if not hasattr(actor, "student_profile") or actor.student_profile.id != student.id:
                raise PermissionDenied("لا يمكنك تسجيل مراجعة لطالب آخر.")
        else:
            raise PermissionDenied("ليس لديك صلاحية لتسجيل المراجعة.")

    reviewed_on = reviewed_date or date_cls.today()

    defaults = {
        "quality": quality or "acceptable",
        "note": note or "",
        "recorded_by": actor,
    }
    if id is not None:
        defaults["id"] = id

    record, _ = ReviewRecord.objects.update_or_create(
        student=student,
        surah_name=str(surah_name).strip(),
        reviewed_date=reviewed_on,
        defaults=defaults,
    )
    return record


@transaction.atomic
def review_record_update(*, record: ReviewRecord, actor: User, data: dict) -> ReviewRecord:
    """Update a review record. Admin, owning teacher, or the student themselves."""
    if not is_admin_user(actor):
        if actor.role == "teacher":
            if not hasattr(actor, "teacher_profile") or record.student.teacher_id != actor.teacher_profile.id:
                raise PermissionDenied("لا يمكنك تعديل مراجعة لطالب ليس في حلقتك.")
        elif actor.role == "student":
            if not hasattr(actor, "student_profile") or actor.student_profile.id != record.student_id:
                raise PermissionDenied("لا يمكنك تعديل مراجعة لطالب آخر.")
        else:
            raise PermissionDenied("ليس لديك صلاحية لتعديل المراجعة.")

    allowed = ["surah_name", "reviewed_date", "quality", "note"]
    for field, value in data.items():
        if field in allowed:
            setattr(record, field, value)
    record.full_clean()
    record.save()
    return record


@transaction.atomic
def review_record_delete(*, record: ReviewRecord, actor: User) -> None:
    """Delete a review record. Admin or owning teacher only."""
    if not is_admin_user(actor):
        if actor.role != "teacher" or not hasattr(actor, "teacher_profile"):
            raise PermissionDenied("ليس لديك صلاحية لحذف المراجعة.")
        if record.student.teacher_id != actor.teacher_profile.id:
            raise PermissionDenied("لا يمكنك حذف مراجعة لطالب ليس في حلقتك.")

    from sync.models import Tombstone
    from sync.services.tombstone_service import tombstone_write

    deleted_uuid = record.id
    record.delete()
    tombstone_write(
        resource=Tombstone.Resource.REVIEW_RECORD,
        resource_uuid=deleted_uuid,
        actor=actor,
        scope_user_id=None,
    )
