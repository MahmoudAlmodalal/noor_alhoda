from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from accounts.models import User
from core.permissions import is_admin_user
from evaluations.models import Evaluation
from students.models import Student


def evaluation_list_for_student(*, student: Student) -> QuerySet[Evaluation]:
    """
    Evaluations for a student, ordered by scheduled date.
    RBAC: callers must enforce student access (via student_get) before calling.
    """
    return (
        Evaluation.objects.select_related("student")
        .filter(student=student)
        .order_by("scheduled_date")
    )


def evaluation_get(*, evaluation_id, actor: User) -> Evaluation:
    """
    Fetch a single evaluation and enforce teacher-of-student ownership.
    Admin passes; teacher must own the evaluation's student.
    """
    evaluation = get_object_or_404(
        Evaluation.objects.select_related("student"), id=evaluation_id
    )
    if is_admin_user(actor):
        return evaluation
    if actor.role == "teacher":
        if (
            not hasattr(actor, "teacher_profile")
            or evaluation.student.teacher_id != actor.teacher_profile.id
        ):
            raise PermissionDenied("لا يمكنك الوصول إلى اختبار طالب ليس في حلقتك.")
        return evaluation
    raise PermissionDenied("ليس لديك صلاحية لعرض هذا الاختبار.")
