from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from core.permissions import is_admin_user
from courses.models import Course, StudentCourse
from students.models import Student


@transaction.atomic
def course_create(*, actor: User, name: str, description: str = "", id=None) -> Course:
    """إنشاء دورة جديدة. للمدير فقط."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه إنشاء الدورات.")

    if not name or not name.strip():
        raise ValidationError({"name": "اسم الدورة مطلوب."})

    if Course.objects.filter(name=name.strip()).exists():
        raise ValidationError({"name": "يوجد دورة بنفس الاسم مسبقاً."})

    course_kwargs = {"name": name.strip(), "description": description or ""}
    if id is not None:
        course_kwargs["id"] = id
    course = Course(**course_kwargs)
    course.full_clean()
    course.save()
    return course


@transaction.atomic
def course_update(
    *,
    actor: User,
    course: Course | None = None,
    course_id=None,
    data: dict | None = None,
) -> Course:
    """تعديل دورة. للمدير فقط. يقبل إما الدورة مباشرة أو معرّفها."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه تعديل الدورات.")

    if course is None:
        if course_id is None:
            raise ValidationError("يجب تحديد الدورة.")
        course = get_object_or_404(Course, id=course_id)

    allowed = ["name", "description"]
    for field, value in (data or {}).items():
        if field in allowed and value is not None:
            setattr(course, field, value)

    course.full_clean()
    course.save()
    return course


@transaction.atomic
def course_delete(
    *,
    actor: User,
    course: Course | None = None,
    course_id=None,
) -> None:
    """حذف دورة. للمدير فقط."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه حذف الدورات.")

    if course is None:
        if course_id is None:
            raise ValidationError("يجب تحديد الدورة.")
        course = get_object_or_404(Course, id=course_id)

    from sync.models import Tombstone
    from sync.services.tombstone_service import tombstone_write

    deleted_uuid = course.id
    course.delete()
    tombstone_write(
        resource=Tombstone.Resource.COURSE,
        resource_uuid=deleted_uuid,
        actor=actor,
        scope_user_id=None,
    )


@transaction.atomic
def student_course_set_status(
    *,
    actor: User,
    student_id,
    course_id,
    is_completed: bool,
) -> StudentCourse:
    """تعيين حالة دورة لطالب (أخذها / لم يأخذها). للمدير فقط. (المسار القديم)"""
    return student_course_set(
        actor=actor,
        student_id=student_id,
        course_id=course_id,
        is_completed=is_completed,
    )


@transaction.atomic
def student_course_set(
    *,
    actor: User,
    student_id,
    course_id,
    is_completed: bool = False,
    completion_date=None,
    id=None,
) -> StudentCourse:
    """Upsert a StudentCourse enrollment. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه تعديل حالة دورات الطلاب.")

    student = get_object_or_404(Student, id=student_id)
    course = get_object_or_404(Course, id=course_id)

    if completion_date is None and is_completed:
        completion_date = timezone.now().date()

    defaults = {
        "is_completed": is_completed,
        "completion_date": completion_date,
    }
    if id is not None:
        defaults["id"] = id

    enrollment, _ = StudentCourse.objects.update_or_create(
        student=student,
        course=course,
        defaults=defaults,
    )
    return enrollment


@transaction.atomic
def student_course_update(
    *,
    enrollment: StudentCourse,
    actor: User,
    data: dict,
) -> StudentCourse:
    """Update a StudentCourse. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه تعديل دورات الطلاب.")

    allowed = ["is_completed", "completion_date"]
    for field, value in data.items():
        if field in allowed:
            setattr(enrollment, field, value)
    enrollment.full_clean()
    enrollment.save()
    return enrollment


@transaction.atomic
def student_course_delete(*, enrollment: StudentCourse, actor: User) -> None:
    """Delete a StudentCourse. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه حذف تسجيل الطالب بالدورة.")

    from sync.models import Tombstone
    from sync.services.tombstone_service import tombstone_write

    deleted_uuid = enrollment.id
    enrollment.delete()
    tombstone_write(
        resource=Tombstone.Resource.STUDENT_COURSE,
        resource_uuid=deleted_uuid,
        actor=actor,
        scope_user_id=None,
    )
