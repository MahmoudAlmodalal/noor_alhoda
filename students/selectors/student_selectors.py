from django.db.models import QuerySet, Q, Sum, Count, Avg
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from students.models import Student
from accounts.models import User, ParentStudentLink


def can_access_student(*, actor: User, student: Student) -> bool:
    """
    RBAC check for student access.
    FR-07: Admin — full access
    FR-08: Teacher — own students only
    FR-09: Student — self only
    FR-10: Parent — linked children only
    """
    if actor.role == "admin":
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
    qs = Student.objects.select_related("user", "teacher").filter(is_active=True)

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
    elif user.role != "admin":
        return qs.none()

    # Filters
    teacher_id = filters.get("teacher_id")
    if teacher_id:
        qs = qs.filter(teacher_id=teacher_id)

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


def student_history(*, student_id, actor: User):
    """
    Return full memorization history (WeeklyPlans) for a student.
    """
    from records.models import WeeklyPlan

    student = student_get(student_id=student_id, actor=actor)
    return WeeklyPlan.objects.filter(
        student=student
    ).prefetch_related("daily_records").order_by("-week_start")


def student_stats(*, student_id, actor: User) -> dict:
    """
    Calculate student statistics: attendance rate, total verses, etc.
    """
    from records.models import DailyRecord, WeeklyPlan

    student = student_get(student_id=student_id, actor=actor)

    # Attendance stats
    total_records = DailyRecord.objects.filter(
        weekly_plan__student=student
    ).count()

    present_records = DailyRecord.objects.filter(
        weekly_plan__student=student,
        attendance__in=["present", "late"],
    ).count()

    attendance_rate = (present_records / total_records * 100) if total_records > 0 else 0

    # Memorization stats
    totals = WeeklyPlan.objects.filter(student=student).aggregate(
        total_required=Sum("total_required"),
        total_achieved=Sum("total_achieved"),
    )

    total_required = totals["total_required"] or 0
    total_achieved = totals["total_achieved"] or 0

    return {
        "student_id": str(student.id),
        "student_name": student.full_name,
        "attendance_rate": round(attendance_rate, 1),
        "total_days": total_records,
        "present_days": present_records,
        "total_required_verses": total_required,
        "total_achieved_verses": total_achieved,
        "overall_completion_rate": round(
            (total_achieved / total_required * 100) if total_required > 0 else 0, 1
        ),
    }
