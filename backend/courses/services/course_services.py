from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from core.permissions import is_admin_user
from courses.models import Course, StudentCourse
from students.models import Student


@transaction.atomic
def course_create(*, actor: User, name: str, description: str = "") -> Course:
    """إنشاء دورة جديدة. للمدير فقط."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه إنشاء الدورات.")

    if not name or not name.strip():
        raise ValidationError({"name": "اسم الدورة مطلوب."})

    if Course.objects.filter(name=name.strip()).exists():
        raise ValidationError({"name": "يوجد دورة بنفس الاسم مسبقاً."})

    course = Course(name=name.strip(), description=description or "")
    course.full_clean()
    course.save()
    return course


@transaction.atomic
def course_update(*, actor: User, course_id, data: dict) -> Course:
    """تعديل دورة. للمدير فقط."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه تعديل الدورات.")

    course = get_object_or_404(Course, id=course_id)

    allowed = ["name", "description"]
    for field, value in data.items():
        if field in allowed and value is not None:
            setattr(course, field, value)

    course.full_clean()
    course.save()
    return course


@transaction.atomic
def course_delete(*, actor: User, course_id) -> None:
    """حذف دورة. للمدير فقط."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه حذف الدورات.")

    course = get_object_or_404(Course, id=course_id)
    course.delete()


@transaction.atomic
def student_course_set_status(
    *,
    actor: User,
    student_id,
    course_id,
    is_completed: bool,
) -> StudentCourse:
    """تعيين حالة دورة لطالب (أخذها / لم يأخذها). للمدير فقط."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه تعديل حالة دورات الطلاب.")

    student = get_object_or_404(Student, id=student_id)
    course = get_object_or_404(Course, id=course_id)

    completion_date = timezone.now().date() if is_completed else None

    enrollment, _created = StudentCourse.objects.update_or_create(
        student=student,
        course=course,
        defaults={
            "is_completed": is_completed,
            "completion_date": completion_date,
        },
    )
    return enrollment
