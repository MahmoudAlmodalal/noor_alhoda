from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied

from records.models import WeeklyPlan, DailyRecord
from accounts.models import User
from students.models import Student
from notifications.services.notification_services import send_absence_notification
from core.permissions import is_admin_user


@transaction.atomic
def weekly_plan_create(
    *,
    student_id,
    week_start,
    week_number=None,
    total_required=0,
    total_required_lines=0,
    teacher: User,
    id=None,
) -> WeeklyPlan:
    """Create a weekly plan for a student."""
    if not (is_admin_user(teacher) or teacher.role == "teacher"):
        raise PermissionDenied("ليس لديك صلاحية لإنشاء خطة أسبوعية.")

    try:
        student = Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        raise ValidationError({"student_id": "الطالب غير موجود."})

    # Check teacher owns this student (unless admin)
    if teacher.role == "teacher":
        if not hasattr(teacher, "teacher_profile") or student.teacher_id != teacher.teacher_profile.id:
            raise PermissionDenied("لا يمكنك إنشاء خطة لطالب ليس في حلقتك.")

    if WeeklyPlan.objects.filter(student=student, week_start=week_start).exists():
        raise ValidationError("توجد خطة مسبقة لهذا الأسبوع.")

    plan_kwargs = dict(
        student=student,
        week_number=week_number or (
            week_start.isocalendar()[1] if hasattr(week_start, "isocalendar") else 1
        ),
        week_start=week_start,
        total_required=total_required or 0,
        total_required_lines=total_required_lines or 0,
    )
    if id is not None:
        plan_kwargs["id"] = id
    plan = WeeklyPlan(**plan_kwargs)
    plan.full_clean()
    plan.save()

    return plan


@transaction.atomic
def weekly_plan_update(*, plan: WeeklyPlan, actor: User, data: dict) -> WeeklyPlan:
    """Update a weekly plan. Admin or owning teacher only."""
    if not (is_admin_user(actor) or actor.role == "teacher"):
        raise PermissionDenied("ليس لديك صلاحية لتعديل الخطة الأسبوعية.")
    if actor.role == "teacher":
        if not hasattr(actor, "teacher_profile") or plan.student.teacher_id != actor.teacher_profile.id:
            raise PermissionDenied("لا يمكنك تعديل خطة لطالب ليس في حلقتك.")

    allowed = ["week_number", "total_required", "total_required_lines"]
    for field, value in data.items():
        if field in allowed:
            setattr(plan, field, value)
    plan.full_clean()
    plan.save()
    return plan


@transaction.atomic
def weekly_plan_delete(*, plan: WeeklyPlan, actor: User) -> None:
    """Delete a weekly plan. Admin or owning teacher only (cascades daily records)."""
    if not (is_admin_user(actor) or actor.role == "teacher"):
        raise PermissionDenied("فقط المدير أو المحفظ يمكنه حذف الخطة الأسبوعية.")
    if actor.role == "teacher":
        if not hasattr(actor, "teacher_profile") or plan.student.teacher_id != actor.teacher_profile.id:
            raise PermissionDenied("لا يمكنك حذف خطة لطالب ليس في حلقتك.")

    from sync.models import Tombstone
    from sync.services.tombstone_service import tombstone_write

    deleted_uuid = plan.id
    plan.delete()
    tombstone_write(
        resource=Tombstone.Resource.WEEKLY_PLAN,
        resource_uuid=deleted_uuid,
        actor=actor,
        scope_user_id=None,
    )


def _to_int(val, default=0) -> int:
    if val is None or val == "":
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _to_int_or_none(val) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


@transaction.atomic
def daily_record_create(*, teacher: User, id=None, **data) -> DailyRecord:
    """Create a daily record for a student. WeeklyPlan is optional."""
    if not (is_admin_user(teacher) or teacher.role == "teacher"):
        raise PermissionDenied("ليس لديك صلاحية لتسجيل السجلات.")

    student_id = data.get("student_id")
    plan_id = data.get("weekly_plan_id")

    plan = None
    if plan_id:
        try:
            plan = WeeklyPlan.objects.select_related("student").get(id=plan_id)
            if not student_id:
                student_id = plan.student_id
            elif str(plan.student_id) != str(student_id):
                raise ValidationError({"weekly_plan_id": "الخطة الأسبوعية لا تخص هذا الطالب."})
        except (WeeklyPlan.DoesNotExist, DjangoValidationError, ValueError, TypeError):
            raise ValidationError({"weekly_plan_id": "الخطة الأسبوعية غير موجودة."})

    if not student_id:
        raise ValidationError({"student_id": "الطالب مطلوب."})

    try:
        student = Student.objects.get(id=student_id)
    except (Student.DoesNotExist, DjangoValidationError, ValueError, TypeError):
        raise ValidationError({"student_id": "الطالب غير موجود."})

    # Check teacher owns this student
    if teacher.role == "teacher":
        if not hasattr(teacher, "teacher_profile") or student.teacher_id != teacher.teacher_profile.id:
            raise PermissionDenied("لا يمكنك التسجيل لطالب ليس في حلقتك.")

    from_ayah = _to_int_or_none(data.get("from_ayah"))
    to_ayah = _to_int_or_none(data.get("to_ayah"))
    from_page = _to_int_or_none(data.get("from_page"))
    to_page = _to_int_or_none(data.get("to_page"))
    memorized_lines = _to_int(data.get("memorized_lines"), default=0)

    if from_ayah is not None and to_ayah is not None and to_ayah >= from_ayah:
        achieved_verses = to_ayah - from_ayah + 1
    else:
        achieved_verses = _to_int(data.get("achieved_verses"), default=0)

    record_kwargs = dict(
        student=student,
        weekly_plan=plan,
        day=data.get("day", "sat"),
        date=data.get("date"),
        attendance=data.get("attendance", "present"),
        required_verses=_to_int(data.get("required_verses"), default=0),
        achieved_verses=achieved_verses,
        from_ayah=from_ayah,
        to_ayah=to_ayah,
        from_page=from_page,
        to_page=to_page,
        memorized_lines=memorized_lines,
        surah_name=data.get("surah_name", ""),
        quality=data.get("quality", "none"),
        review_surah_name=data.get("review_surah_name", ""),
        review_from_ayah=_to_int_or_none(data.get("review_from_ayah")),
        review_to_ayah=_to_int_or_none(data.get("review_to_ayah")),
        review_quality=data.get("review_quality", "none"),
        next_memorization_target=data.get("next_memorization_target", ""),
        next_memorization_from_ayah=_to_int_or_none(data.get("next_memorization_from_ayah")),
        next_memorization_to_ayah=_to_int_or_none(data.get("next_memorization_to_ayah")),
        next_review_target=data.get("next_review_target", ""),
        next_review_from_ayah=_to_int_or_none(data.get("next_review_from_ayah")),
        next_review_to_ayah=_to_int_or_none(data.get("next_review_to_ayah")),
        result=data.get("result", "pending"),
        note=data.get("note", ""),
        recorded_by=teacher,
    )
    if id is not None:
        record_kwargs["id"] = id
    record = DailyRecord(**record_kwargs)
    record.full_clean()
    record.save()

    if record.attendance == DailyRecord.Attendance.ABSENT:
        send_absence_notification(student=student, date=record.date)

    return record


@transaction.atomic
def daily_record_delete(*, record: DailyRecord, actor: User) -> None:
    """Delete a daily record. Admin or owning teacher only."""
    if not is_admin_user(actor):
        if actor.role != "teacher" or not hasattr(actor, "teacher_profile"):
            raise PermissionDenied("ليس لديك صلاحية لحذف السجل.")
        if record.student.teacher_id != actor.teacher_profile.id:
            raise PermissionDenied("لا يمكنك حذف سجل لطالب ليس في حلقتك.")

    from sync.models import Tombstone
    from sync.services.tombstone_service import tombstone_write

    deleted_uuid = record.id
    record.delete()
    tombstone_write(
        resource=Tombstone.Resource.DAILY_RECORD,
        resource_uuid=deleted_uuid,
        actor=actor,
        scope_user_id=None,
    )


@transaction.atomic
def daily_record_update(*, record_id, teacher: User, data: dict) -> DailyRecord:
    """
    Update a daily record.
    FR-16: Cannot edit records older than 7 days unless admin.
    """
    try:
        record = DailyRecord.objects.select_related(
            "student", "weekly_plan"
        ).get(id=record_id)
    except DailyRecord.DoesNotExist:
        raise ValidationError("السجل غير موجود.")

    # FR-16: Check age of record
    if not is_admin_user(teacher):
        days_old = (timezone.now().date() - record.date).days
        if days_old > 7:
            raise PermissionDenied(
                "لا يمكنك تعديل سجلات أقدم من 7 أيام. تواصل مع المدير."
            )

    # Teacher ownership check
    if teacher.role == "teacher":
        if not hasattr(teacher, "teacher_profile"):
            raise PermissionDenied("ليس لديك صلاحية.")
        if record.student.teacher_id != teacher.teacher_profile.id:
            raise PermissionDenied("لا يمكنك تعديل سجل لطالب ليس في حلقتك.")

    allowed_fields = [
        "attendance", "required_verses", "achieved_verses",
        "from_ayah", "to_ayah", "from_page", "to_page", "memorized_lines",
        "surah_name", "quality", "result", "note",
        "review_surah_name", "review_from_ayah", "review_to_ayah", "review_quality",
        "next_memorization_target", "next_memorization_from_ayah", "next_memorization_to_ayah",
        "next_review_target", "next_review_from_ayah", "next_review_to_ayah",
    ]

    was_absent = record.attendance == DailyRecord.Attendance.ABSENT

    for field, value in data.items():
        if field in allowed_fields:
            if field in ("required_verses", "achieved_verses", "memorized_lines"):
                value = _to_int(value, default=0)
            elif field in (
                "from_ayah",
                "to_ayah",
                "review_from_ayah",
                "review_to_ayah",
                "next_memorization_from_ayah",
                "next_memorization_to_ayah",
                "next_review_from_ayah",
                "next_review_to_ayah",
            ):
                value = _to_int_or_none(value)
            setattr(record, field, value)

    # Auto-calculate achieved_verses from ayah range if both are set
    if record.from_ayah is not None and record.to_ayah is not None and record.to_ayah >= record.from_ayah:
        record.achieved_verses = record.to_ayah - record.from_ayah + 1

    record.recorded_by = teacher
    record.full_clean()
    record.save()

    if not was_absent and record.attendance == DailyRecord.Attendance.ABSENT:
        send_absence_notification(
            student=record.student,
            date=record.date,
        )

    return record


@transaction.atomic
def bulk_attendance_create(*, teacher: User, date, attendance_data: list) -> dict:
    """
    FR-12: Bulk attendance registration for all students in a halaqah.
    attendance_data: [{"student_id": "...", "attendance": "present/absent/late/excused"}, ...]
    Returns {"records": [...], "skipped": [{"student_id": ..., "reason": ...}, ...]}.
    """
    if not (is_admin_user(teacher) or teacher.role == "teacher"):
        raise PermissionDenied("ليس لديك صلاحية لتسجيل الحضور.")

    if date.weekday() == 4:
        raise ValidationError({"date": "لا يمكن تسجيل الحضور ليوم الجمعة."})

    created_records = []
    skipped = []

    for entry in attendance_data:
        student_id = entry.get("student_id")
        attendance = entry.get("attendance", "present")

        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            skipped.append({"student_id": str(student_id), "reason": "not_found"})
            continue

        # Check ownership
        if teacher.role == "teacher":
            if not hasattr(teacher, "teacher_profile") or student.teacher_id != teacher.teacher_profile.id:
                skipped.append({"student_id": str(student_id), "reason": "not_owned"})
                continue

        # Find weekly plan for the current week if exists
        weekday = date.weekday()  # Monday = 0
        days_since_saturday = (weekday + 2) % 7
        week_start = date - timedelta(days=days_since_saturday)

        plan = WeeklyPlan.objects.filter(
            student=student,
            week_start=week_start,
        ).first()

        # Determine day code
        day_map = {5: "sat", 6: "sun", 0: "mon", 1: "tue", 2: "wed", 3: "thu"}
        day_code = day_map.get(date.weekday(), "sat")

        # Create or update record by student and date
        previous_record = DailyRecord.objects.filter(
            student=student,
            date=date,
        ).first()

        record, created = DailyRecord.objects.update_or_create(
            student=student,
            date=date,
            defaults={
                "weekly_plan": plan,
                "day": day_code,
                "attendance": attendance,
                "recorded_by": teacher,
            },
        )

        if attendance == DailyRecord.Attendance.ABSENT:
            previous_attendance = previous_record.attendance if previous_record else None
            if previous_attendance != DailyRecord.Attendance.ABSENT:
                send_absence_notification(student=student, date=date)

        created_records.append(record)

    return {"records": created_records, "skipped": skipped}
