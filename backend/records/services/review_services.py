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

    record, _ = ReviewRecord.objects.update_or_create(
        student=student,
        surah_name=str(surah_name).strip(),
        reviewed_date=reviewed_on,
        defaults={
            "quality": quality or "acceptable",
            "note": note or "",
            "recorded_by": actor,
        },
    )
    return record
