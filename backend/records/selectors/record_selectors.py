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
    Automatically snaps any given date to the corresponding Saturday (week start).
    """
    from datetime import date as date_cls, timedelta
    from students.selectors.student_selectors import can_access_student, student_get

    student = student_get(student_id=student_id, actor=actor)

    # Snap to the Saturday of the given week
    parsed_date = date_cls.fromisoformat(str(week_start))
    days_since_sat = (parsed_date.weekday() - 5) % 7
    saturday = parsed_date - timedelta(days=days_since_sat)

    try:
        plan = WeeklyPlan.objects.get(student=student, week_start=saturday)
    except WeeklyPlan.DoesNotExist:
        return {
            "student_id": str(student.id),
            "student_name": student.full_name,
            "week_start": str(saturday),
            "days": [],
            "message": "لا توجد خطة لهذا الأسبوع.",
        }

    records = plan.daily_records.all().order_by("date")

    # Build days list with recorded data
    all_days = ["sat", "sun", "mon", "tue", "wed", "thu"]
    day_labels = {
        "sat": "السبت", "sun": "الأحد", "mon": "الاثنين",
        "tue": "الثلاثاء", "wed": "الأربعاء", "thu": "الخميس",
    }

    # Index recorded days
    recorded = {}
    for r in records:
        recorded[r.day] = r

    today = date_cls.today()
    days_list = []
    for i, day_code in enumerate(all_days):
        day_date = saturday + timedelta(days=i)
        if day_code in recorded:
            r = recorded[day_code]
            days_list.append({
                "day": day_labels[day_code],
                "date": str(r.date),
                "attendance": r.attendance,
                "required": f"{r.required_verses} آيات" if r.required_verses else "-",
                "achieved": f"{r.achieved_verses} آيات" if r.achieved_verses else "-",
                "evaluation": r.quality,
                "result": r.result,
                "surah_name": r.surah_name,
                "note": r.note,
            })
        else:
            # Upcoming or missed day
            attendance = "upcoming" if day_date > today else "absent"
            days_list.append({
                "day": day_labels[day_code],
                "date": str(day_date),
                "attendance": attendance,
                "required": "-",
                "achieved": "-",
                "evaluation": "none",
                "result": "none",
                "surah_name": "",
                "note": "",
            })

    return {
        "student_id": str(student.id),
        "student_name": student.full_name,
        "week_number": plan.week_number,
        "week_start": str(plan.week_start),
        "total_required": plan.total_required,
        "total_achieved": plan.total_achieved,
        "completion_rate": plan.completion_rate,
        "days": days_list,
    }
