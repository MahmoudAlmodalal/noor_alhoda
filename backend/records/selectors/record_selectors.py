from django.db.models import QuerySet, Sum
from rest_framework.exceptions import PermissionDenied

from records.models import DailyRecord, WeeklyPlan
from accounts.models import User
from core.permissions import is_admin_user


def daily_records_by_date(*, teacher_user: User, date) -> QuerySet[DailyRecord]:
    """
    Get all daily records for a teacher's students on a given date.
    Teacher can only see their own students' records.
    """
    if not (is_admin_user(teacher_user) or teacher_user.role == "teacher"):
        raise PermissionDenied("ليس لديك صلاحية لعرض السجلات.")

    qs = DailyRecord.objects.select_related(
        "weekly_plan", "weekly_plan__student", "recorded_by"
    ).filter(date=date)

    if teacher_user.role == "teacher":
        if not hasattr(teacher_user, "teacher_profile"):
            raise PermissionDenied("حساب المحفظ غير مكتمل.")
        qs = qs.filter(weekly_plan__student__teacher=teacher_user.teacher_profile)

    return qs.order_by("weekly_plan__student__full_name")


def weekly_plans_list(*, actor: User, week_start=None) -> list:
    """
    List weekly plans for a teacher's students (or all if admin).
    Optionally filtered by week_start date.
    """
    if not (is_admin_user(actor) or actor.role == "teacher"):
        raise PermissionDenied("ليس لديك صلاحية لعرض الخطط.")

    qs = WeeklyPlan.objects.select_related("student", "student__teacher").order_by("-week_start", "student__full_name")

    if actor.role == "teacher":
        if not hasattr(actor, "teacher_profile"):
            raise PermissionDenied("حساب المحفظ غير مكتمل.")
        qs = qs.filter(student__teacher=actor.teacher_profile)

    if week_start:
        qs = qs.filter(week_start=week_start)

    return [
        {
            "id": str(p.id),
            "student_id": str(p.student_id),
            "student_name": p.student.full_name,
            "week_number": p.week_number,
            "week_start": str(p.week_start),
            "total_required": p.total_required,
            "total_achieved": p.total_achieved,
            "completion_rate": p.completion_rate,
        }
        for p in qs
    ]


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
                "result": r.get_result_display(),
                "note": r.note,
            }
            for r in records
        ],
    }
