from datetime import date as date_cls, timedelta
from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import User
from core.permissions import is_admin_user
from records.models import ReviewRecord, SurahMastery
from students.models import Student


# SM-2-lite constants — tune here, not via migration. The defaults are a
# sensible starting point; adjust after observing real student data.
REVIEW_EASE_DEFAULT = Decimal("2.50")
REVIEW_EASE_MIN = Decimal("1.30")
REVIEW_EASE_MAX = Decimal("2.80")
REVIEW_EASE_EXCELLENT_BONUS = Decimal("0.15")
REVIEW_EASE_ACCEPTABLE_PENALTY = Decimal("0.15")
REVIEW_EASE_WEAK_PENALTY = Decimal("0.20")
REVIEW_INTERVAL_CAP_DAYS = 180
REVIEW_GOOD_EASE_MULTIPLIER = 0.85
REVIEW_ACCEPTABLE_INTERVAL_MULTIPLIER = 0.6

VALID_QUALITIES = {"excellent", "good", "acceptable", "weak", "none"}


def _apply_quality_to_mastery(
    mastery: SurahMastery, quality: str, *, as_of: date_cls
) -> None:
    """
    Update mastery state in-place per SM-2-lite. Caller is responsible for
    persisting with .save(). Quality 'none' is a no-op (logged attempt, no
    schedule change).
    """
    prev_interval = max(1, int(mastery.interval_days or 1))
    ease = mastery.ease_factor or REVIEW_EASE_DEFAULT

    if quality == "excellent":
        new_interval = max(1, round(prev_interval * float(ease)))
        new_ease = min(REVIEW_EASE_MAX, ease + REVIEW_EASE_EXCELLENT_BONUS)
        mastery.streak = (mastery.streak or 0) + 1
    elif quality == "good":
        new_interval = max(
            1, round(prev_interval * max(1.0, float(ease) * REVIEW_GOOD_EASE_MULTIPLIER))
        )
        new_ease = ease
        mastery.streak = (mastery.streak or 0) + 1
    elif quality == "acceptable":
        new_interval = max(
            1, round(prev_interval * REVIEW_ACCEPTABLE_INTERVAL_MULTIPLIER)
        )
        new_ease = max(REVIEW_EASE_MIN, ease - REVIEW_EASE_ACCEPTABLE_PENALTY)
        mastery.streak = (mastery.streak or 0) + 1
    elif quality == "weak":
        new_interval = 1
        new_ease = max(REVIEW_EASE_MIN, ease - REVIEW_EASE_WEAK_PENALTY)
        mastery.streak = 0
        mastery.lapses = (mastery.lapses or 0) + 1
    else:
        # "none" → logged but no schedule update.
        return

    clamped = max(1, min(REVIEW_INTERVAL_CAP_DAYS, new_interval))
    mastery.ease_factor = new_ease
    mastery.interval_days = clamped
    mastery.next_due_date = as_of + timedelta(days=clamped)
    mastery.last_reviewed_at = as_of


def _get_or_bootstrap_mastery(
    *, student: Student, surah_name: str, reviewed_on: date_cls
) -> SurahMastery:
    """
    Fetch the mastery row for (student, surah) or create one seeded from
    student.review_interval_days. Called inside a transaction.
    """
    base_interval = student.review_interval_days or 14
    mastery, _ = SurahMastery.objects.get_or_create(
        student=student,
        surah_name=surah_name,
        defaults={
            "ease_factor": REVIEW_EASE_DEFAULT,
            "interval_days": base_interval,
            "next_due_date": reviewed_on,
            "streak": 0,
            "lapses": 0,
        },
    )
    return mastery


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
    """Create or upsert a review record and update the surah mastery state."""
    if not surah_name or not str(surah_name).strip():
        raise ValidationError({"surah_name": "اسم السورة مطلوب."})

    quality = quality or "acceptable"
    if quality not in VALID_QUALITIES:
        raise ValidationError({"quality": "قيمة جودة المراجعة غير صالحة."})

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
    clean_surah = str(surah_name).strip()

    defaults = {
        "quality": quality,
        "note": note or "",
        "recorded_by": actor,
    }
    if id is not None:
        defaults["id"] = id

    record, _ = ReviewRecord.objects.update_or_create(
        student=student,
        surah_name=clean_surah,
        reviewed_date=reviewed_on,
        defaults=defaults,
    )

    mastery = _get_or_bootstrap_mastery(
        student=student, surah_name=clean_surah, reviewed_on=reviewed_on
    )
    _apply_quality_to_mastery(mastery, quality, as_of=reviewed_on)
    mastery.save()

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
