from django.db.models import QuerySet, Q, Sum
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from students.models import Student
from accounts.models import User, ParentStudentLink
from core.permissions import is_admin_user


def can_access_student(*, actor: User, student: Student) -> bool:
    """
    RBAC check for student access.
    FR-07: Admin — full access
    FR-08: Teacher — own students only
    FR-09: Student — self only
    FR-10: Parent — linked children only
    """
    if is_admin_user(actor):
        return True
    elif actor.role == "teacher":
        return (
            hasattr(actor, "teacher_profile")
            and student.teacher_id == actor.teacher_profile.id
        )
    elif actor.role == "student":
        return hasattr(actor, "student_profile") and actor.student_profile.id == student.id
    elif actor.role == "parent":
        return ParentStudentLink.objects.filter(
            parent__user=actor, student=student
        ).exists()
    return False


def student_list(*, filters: dict, user: User) -> QuerySet[Student]:
    """
    Return filtered student list with role-based access.
    FR-11: Row-Level Security.
    """
    qs = Student.objects.select_related("user", "teacher").all()

    # Role-based filtering
    if user.role == "teacher" and hasattr(user, "teacher_profile"):
        qs = qs.filter(teacher=user.teacher_profile)
    elif user.role == "parent":
        linked_ids = ParentStudentLink.objects.filter(
            parent__user=user
        ).values_list("student_id", flat=True)
        qs = qs.filter(id__in=linked_ids)
    elif user.role == "student":
        qs = qs.filter(user=user)
    elif not is_admin_user(user):
        return qs.none()

    # Filters
    teacher_id = filters.get("teacher_id")
    if teacher_id:
        qs = qs.filter(teacher_id=teacher_id)

    course_id = filters.get("course_id")
    if course_id:
        qs = qs.filter(course_enrollments__course_id=course_id).distinct()

    grade = filters.get("grade")
    if grade:
        qs = qs.filter(grade=grade)

    search = filters.get("search")
    if search:
        qs = qs.filter(
            Q(full_name__icontains=search)
            | Q(national_id__icontains=search)
        )

    return qs


def student_get(*, student_id, actor: User) -> Student:
    """Get a single student with permission check."""
    student = get_object_or_404(
        Student.objects.select_related("user", "teacher"),
        id=student_id,
    )
    if not can_access_student(actor=actor, student=student):
        raise PermissionDenied("ليس لديك صلاحية لعرض بيانات هذا الطالب.")
    return student


def student_history(*, student_id, actor: User) -> list:
    """
    Return full memorization history (WeeklyPlans) for a student,
    enriched with title and rating for frontend display.
    """
    from records.models import WeeklyPlan

    student = student_get(student_id=student_id, actor=actor)
    plans = WeeklyPlan.objects.filter(
        student=student
    ).prefetch_related("daily_records").order_by("-week_start")

    history = []
    for plan in plans:
        records = plan.daily_records.all().order_by("-date")
        last_record = records.first()

        # Build a meaningful title from the surah name
        title = f"الأسبوع {plan.week_number}"
        if last_record and last_record.surah_name:
            title = f"تسميع {last_record.surah_name}"

        # Derive rating from completion rate
        rate = plan.completion_rate
        if rate >= 90:
            rating = "excellent"
        elif rate >= 75:
            rating = "very_good"
        elif rate >= 50:
            rating = "good"
        else:
            rating = "none"

        history.append({
            "id": str(plan.id),
            "title": title,
            "date": str(plan.week_start),
            "rating": rating,
            "week_number": plan.week_number,
            "total_required": plan.total_required,
            "total_achieved": plan.total_achieved,
            "completion_rate": plan.completion_rate,
        })

    return history


def student_stats(*, student_id, actor: User) -> dict:
    """
    Calculate student statistics: attendance rate, total verses, etc.
    """
    from datetime import date as date_cls
    from records.models import DailyRecord, WeeklyPlan

    student = student_get(student_id=student_id, actor=actor)

    # Attendance stats
    all_records = DailyRecord.objects.filter(
        weekly_plan__student=student
    )
    total_records = all_records.count()

    present_records = all_records.filter(
        attendance__in=["present", "late"],
    ).count()

    absent_records = all_records.filter(attendance="absent").count()

    attendance_rate = (present_records / total_records * 100) if total_records > 0 else 0

    # Memorization stats
    totals = WeeklyPlan.objects.filter(student=student).aggregate(
        total_required=Sum("total_required"),
        total_achieved=Sum("total_achieved"),
    )

    total_required = totals["total_required"] or 0
    total_achieved = totals["total_achieved"] or 0

    overall_completion_rate = round(
        (total_achieved / total_required * 100) if total_required > 0 else 0, 1
    )

    # Average quality grade
    quality_map = {"excellent": 4, "good": 3, "acceptable": 2, "weak": 1, "none": 0}
    quality_records = all_records.exclude(quality="none").values_list("quality", flat=True)
    if quality_records:
        avg_score = sum(quality_map.get(q, 0) for q in quality_records) / len(quality_records)
        if avg_score >= 3.5:
            avg_grade = "ممتاز"
        elif avg_score >= 2.5:
            avg_grade = "جيد جداً"
        elif avg_score >= 1.5:
            avg_grade = "جيد"
        else:
            avg_grade = "ضعيف"
    else:
        avg_grade = "-"
        avg_score = 0

    # Streak: consecutive present days from most recent backwards
    streak = 0
    recent_records = all_records.order_by("-date").values_list("attendance", flat=True)
    for att in recent_records:
        if att in ("present", "late"):
            streak += 1
        else:
            break

    # Memorized parts (juz') — approximate: ~604 verses per juz
    memorized_parts = total_achieved // 604 if total_achieved > 0 else 0

    # Points: simple gamification formula
    points = present_records * 10 + total_achieved * 5

    # Memorization level
    if memorized_parts >= 10:
        level_prefix = f"{memorized_parts} أجزاء"
    elif memorized_parts >= 1:
        level_prefix = f"جزء {'عم' if memorized_parts == 1 else 'تبارك' if memorized_parts == 2 else str(memorized_parts)}"
    else:
        level_prefix = "مبتدئ"
    memorization_level = f"{level_prefix} - {avg_grade}" if avg_grade != "-" else level_prefix

    # Current goal and progress from latest weekly plan
    latest_plan = WeeklyPlan.objects.filter(student=student).order_by("-week_start").first()
    if latest_plan:
        # Try to get surah name from latest record
        latest_record = DailyRecord.objects.filter(
            weekly_plan=latest_plan, surah_name__gt=""
        ).order_by("-date").first()
        current_goal = f"حفظ {latest_record.surah_name}" if latest_record else "إتمام الخطة الأسبوعية"
        goal_progress = round(latest_plan.completion_rate, 0)
    else:
        current_goal = "لم يتم تحديد هدف بعد"
        goal_progress = 0

    # Today's record
    today = date_cls.today()
    today_record_obj = all_records.filter(date=today).first()
    today_record = None
    if today_record_obj:
        today_record = {
            "attendance": today_record_obj.attendance,
            "quality": today_record_obj.quality,
            "result": today_record_obj.result,
            "surah_name": today_record_obj.surah_name,
            "achieved_verses": today_record_obj.achieved_verses,
            "required_verses": today_record_obj.required_verses,
        }

    return {
        "student_id": str(student.id),
        "student_name": student.full_name,
        "attendance_rate": round(attendance_rate, 1),
        "total_days": total_records,
        "present_days": present_records,
        "total_present": present_records,
        "total_absent": absent_records,
        "total_required_verses": total_required,
        "total_achieved_verses": total_achieved,
        "overall_completion_rate": overall_completion_rate,
        "overall_rate": f"{round(attendance_rate, 0):.0f}%",
        "avg_grade": avg_grade,
        "memorized_parts": memorized_parts,
        "streak": streak,
        "points": points,
        "memorization_level": memorization_level,
        "current_goal": current_goal,
        "goal_progress": goal_progress,
        "today_record": today_record,
    }
