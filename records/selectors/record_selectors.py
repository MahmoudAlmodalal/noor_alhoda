from django.db.models import QuerySet, Sum
from rest_framework.exceptions import PermissionDenied

from records.models import DailyRecord, WeeklyPlan
from accounts.models import User


def daily_records_by_date(*, teacher_user: User, date) -> QuerySet[DailyRecord]:
    """
    Get all daily records for a teacher's students on a given date.
    Teacher can only see their own students' records.
    """
    if teacher_user.role not in ("admin", "teacher"):
        raise PermissionDenied("ليس لديك صلاحية لعرض السجلات.")

    qs = DailyRecord.objects.select_related(
        "weekly_plan", "weekly_plan__student", "recorded_by"
    ).filter(date=date)

    if teacher_user.role == "teacher" and hasattr(teacher_user, "teacher_profile"):
        qs = qs.filter(weekly_plan__student__teacher=teacher_user.teacher_profile)

    return qs.order_by("weekly_plan__student__full_name")


def weekly_summary(*, student_id, week_start, actor: User) -> dict:
    """
    Get weekly summary for a specific student and week.
    """
    from students.selectors.student_selectors import can_access_student, student_get

    student = student_get(student_id=student_id, actor=actor)

    try:
        plan = WeeklyPlan.objects.get(student=student, week_start=week_start)
    except WeeklyPlan.DoesNotExist:
        return {
            "student_id": str(student.id),
            "student_name": student.full_name,
            "week_start": str(week_start),
            "message": "لا توجد خطة لهذا الأسبوع.",
        }

    records = plan.daily_records.all().order_by("date")

    return {
        "student_id": str(student.id),
        "student_name": student.full_name,
        "week_number": plan.week_number,
        "week_start": str(plan.week_start),
        "total_required": plan.total_required,
        "total_achieved": plan.total_achieved,
        "completion_rate": plan.completion_rate,
        "days": [
            {
                "day": r.get_day_display(),
                "date": str(r.date),
                "attendance": r.get_attendance_display(),
                "required_verses": r.required_verses,
                "achieved_verses": r.achieved_verses,
                "surah_name": r.surah_name,
                "quality": r.get_quality_display(),
                "note": r.note,
            }
            for r in records
        ],
    }
