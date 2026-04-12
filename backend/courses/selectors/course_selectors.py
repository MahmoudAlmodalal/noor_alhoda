from __future__ import annotations

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404

from accounts.models import User
from courses.models import Course, StudentCourse
from students.selectors.student_selectors import student_get


def course_list(*, user: User) -> QuerySet[Course]:
    """قائمة بكل الدورات. متاح لكل المستخدمين المصادق عليهم (القراءة)."""
    return Course.objects.all().order_by("-created_at")


def course_get(*, course_id) -> Course:
    return get_object_or_404(Course, id=course_id)


def student_courses_list(*, student_id, actor: User) -> list[dict]:
    """
    يرجع قائمة بكل الدورات في النظام مع حالة كل دورة للطالب.
    يتحقق من صلاحية الوصول للطالب عبر student_get.
    """
    student = student_get(student_id=student_id, actor=actor)

    enrollments = {
        str(e.course_id): e
        for e in StudentCourse.objects.filter(student=student)
    }

    result: list[dict] = []
    for course in Course.objects.all().order_by("-created_at"):
        enrollment = enrollments.get(str(course.id))
        result.append(
            {
                "course_id": str(course.id),
                "course_name": course.name,
                "description": course.description,
                "is_completed": bool(enrollment.is_completed) if enrollment else False,
                "completion_date": enrollment.completion_date if enrollment else None,
            }
        )
    return result
