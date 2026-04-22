from django.db.models import Sum, Count, Avg, Q, QuerySet
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from students.models import Student
from records.models import DailyRecord, WeeklyPlan
from accounts.models import User
from teacher.models import Teacher


def student_for_report(*, student_id) -> Student:
    """Fetch a student (with related user + teacher) for PDF generation."""
    return Student.objects.select_related("user", "teacher").get(id=student_id)


def weekly_plans_for_report(*, student: Student, limit: int = 12) -> QuerySet[WeeklyPlan]:
    """Most recent `limit` weekly plans for a student, newest first."""
    return WeeklyPlan.objects.filter(student=student).order_by("-week_start")[:limit]


def dashboard_data(*, admin_user) -> dict:
    """
    Admin dashboard data (feature 5.1):
    - Total students, active students
    - Today's attendance stats
    - Weekly achievement average
    """
    today = timezone.now().date()

    total_students = Student.objects.filter(user__is_active=True).count()
    total_teachers = Teacher.objects.filter(user__is_active=True).count()

    # Outstanding memorizers: distinct students with at least one "excellent" record today
    outstanding_count = (
        DailyRecord.objects
        .filter(date=today, quality="excellent")
        .values("weekly_plan__student")
        .distinct()
        .count()
    )

    # Today's attendance
    today_records = DailyRecord.objects.filter(date=today)
    present_today = today_records.filter(attendance__in=["present", "late"]).count()
    absent_today = today_records.filter(attendance="absent").count()

    # This week's achievement (average completion rate)
    # Get the Saturday of the current week
    weekday = today.weekday()
    days_since_saturday = (weekday + 2) % 7
    week_start = today - timezone.timedelta(days=days_since_saturday)

    weekly_plans = WeeklyPlan.objects.filter(week_start=week_start)
    total_required = weekly_plans.aggregate(s=Sum("total_required"))["s"] or 0
    total_achieved = weekly_plans.aggregate(s=Sum("total_achieved"))["s"] or 0
    avg_completion = round((total_achieved / total_required * 100) if total_required > 0 else 0, 1)

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "outstanding_count": outstanding_count,
        "today": {
            "date": str(today),
            "present": present_today,
            "absent": absent_today,
            "total_recorded": today_records.count(),
        },
        "this_week": {
            "week_start": str(week_start),
            "total_required": total_required,
            "total_achieved": total_achieved,
            "avg_completion_rate": avg_completion,
        },
    }


def attendance_report(*, month: int, year: int, actor: User, teacher_id=None) -> dict:
    """
    Monthly attendance report (feature 5.2).
    Optionally filtered by teacher.
    """
    records = DailyRecord.objects.filter(date__month=month, date__year=year)

    if actor.role == "teacher":
        if not hasattr(actor, "teacher_profile"):
            raise PermissionDenied("حساب المحفظ غير مكتمل.")
        if teacher_id and str(actor.teacher_profile.id) != str(teacher_id):
            raise PermissionDenied("لا يمكنك عرض تقرير محفظ آخر.")
        records = records.filter(weekly_plan__student__teacher=actor.teacher_profile)
    elif teacher_id:
        records = records.filter(weekly_plan__student__teacher_id=teacher_id)

    total = records.count()
    present = records.filter(attendance__in=["present", "late"]).count()
    absent = records.filter(attendance="absent").count()
    excused = records.filter(attendance="excused").count()

    attendance_rate = round((present / total * 100) if total > 0 else 0, 1)

    # Per-student breakdown
    student_stats = (
        records
        .values("weekly_plan__student__id", "weekly_plan__student__full_name")
        .annotate(
            total_days=Count("id"),
            present_days=Count("id", filter=Q(attendance__in=["present", "late"])),
            absent_days=Count("id", filter=Q(attendance="absent")),
        )
        .order_by("-absent_days")
    )

    return {
        "month": month,
        "year": year,
        "summary": {
            "total_records": total,
            "present": present,
            "absent": absent,
            "excused": excused,
            "attendance_rate": attendance_rate,
        },
        "students": [
            {
                "student_id": str(s["weekly_plan__student__id"]),
                "student_name": s["weekly_plan__student__full_name"],
                "total_days": s["total_days"],
                "present_days": s["present_days"],
                "absent_days": s["absent_days"],
                "rate": round(
                    (s["present_days"] / s["total_days"] * 100) if s["total_days"] > 0 else 0, 1
                ),
            }
            for s in student_stats
        ],
    }


def leaderboard(*, month: int, year: int, actor: User) -> list:
    """
    Monthly leaderboard — top 10 students by achieved verses (feature 5.4).

    RBAC: admin sees all students center-wide; teachers see their own
    halaqah; students see classmates in their halaqah; parents see the
    halaqahs their linked students belong to.
    """
    base = DailyRecord.objects.filter(date__month=month, date__year=year)

    is_admin = actor.role == "admin" or actor.is_superuser
    if is_admin:
        scoped = base
    elif actor.role == "teacher" and hasattr(actor, "teacher_profile"):
        scoped = base.filter(
            weekly_plan__student__teacher=actor.teacher_profile
        )
    elif actor.role == "student" and hasattr(actor, "student_profile"):
        teacher = actor.student_profile.teacher
        scoped = base.filter(
            weekly_plan__student__teacher=teacher
        ) if teacher else base.none()
    elif actor.role == "parent":
        from accounts.models import ParentStudentLink

        teacher_ids = ParentStudentLink.objects.filter(
            parent__user=actor
        ).values_list("student__teacher_id", flat=True)
        scoped = base.filter(weekly_plan__student__teacher_id__in=teacher_ids)
    else:
        scoped = base.none()

    top_students = (
        scoped
        .values("weekly_plan__student__id", "weekly_plan__student__full_name")
        .annotate(
            total_achieved=Sum("achieved_verses"),
            total_required=Sum("required_verses"),
            present_days=Count("id", filter=Q(attendance__in=["present", "late"])),
        )
        .order_by("-total_achieved")[:10]
    )

    return [
        {
            "rank": idx + 1,
            "student_id": str(s["weekly_plan__student__id"]),
            "student_name": s["weekly_plan__student__full_name"],
            "total_achieved": s["total_achieved"] or 0,
            "total_required": s["total_required"] or 0,
            "present_days": s["present_days"],
        }
        for idx, s in enumerate(top_students)
    ]
