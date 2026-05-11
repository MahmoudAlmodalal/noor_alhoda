"""
Read selectors for StudentProgress.
"""
from django.db.models import QuerySet
from rest_framework.exceptions import NotFound, PermissionDenied

from accounts.models import User
from core.permissions import is_admin_user
from progress.models import StudentProgress
from students.models import Student


def progress_list(*, student_id, actor: User) -> QuerySet[StudentProgress]:
    """
    Return all progress entries for a student, scoped by actor role.
    Admins see all; teachers see their own students; students see themselves.
    """
    # Validate the student exists
    try:
        student = Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        raise NotFound("الطالب غير موجود.")

    # Role-based access
    if is_admin_user(actor):
        pass  # admin sees everything
    elif actor.role == "teacher":
        if not hasattr(actor, "teacher_profile"):
            raise PermissionDenied("المستخدم ليس محفظاً.")
        if str(student.teacher_id) != str(actor.teacher_profile.id):
            raise PermissionDenied("لا يمكنك الوصول لبيانات طالب ليس من حلقتك.")
    elif actor.role == "student":
        if str(student.user_id) != str(actor.id):
            raise PermissionDenied("لا يمكنك الوصول لبيانات طالب آخر.")
    else:
        raise PermissionDenied("غير مصرح.")

    return StudentProgress.objects.filter(
        student_id=student_id
    ).select_related("student", "teacher")


def progress_get(*, progress_id, actor: User) -> StudentProgress:
    """
    Retrieve a single progress entry with permission check.
    """
    try:
        entry = StudentProgress.objects.select_related(
            "student", "teacher"
        ).get(id=progress_id)
    except StudentProgress.DoesNotExist:
        raise NotFound("سجل التقدم غير موجود.")

    # Role-based access
    if is_admin_user(actor):
        return entry
    if actor.role == "teacher":
        if not hasattr(actor, "teacher_profile"):
            raise PermissionDenied("المستخدم ليس محفظاً.")
        if str(entry.student.teacher_id) != str(actor.teacher_profile.id):
            raise PermissionDenied("لا يمكنك الوصول لبيانات طالب ليس من حلقتك.")
    elif actor.role == "student":
        if str(entry.student.user_id) != str(actor.id):
            raise PermissionDenied("لا يمكنك الوصول لبيانات طالب آخر.")
    else:
        raise PermissionDenied("غير مصرح.")

    return entry
