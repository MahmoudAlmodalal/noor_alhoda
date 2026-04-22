"""
Top-level Excel import orchestrator. Coordinates row normalisation, student
lookup/create/update, parent/teacher/course resolution, and per-row error
aggregation inside a per-row atomic block.
"""
from django.db import transaction
from rest_framework.exceptions import PermissionDenied

from accounts.models import ParentStudentLink, User
from core.permissions import is_admin_user
from courses.models import StudentCourse
from students.models import Student
from students.selectors.import_selectors import (
    parent_find_by_user,
    student_exists_for_user,
    student_find_by_national_id,
    teacher_exists_for_user,
    user_find_by_national_id,
)
from students.services.excel_import.normalization import (
    _clean_text,
    _format_exception_message,
    _normalize_course_name,
    _normalize_row,
    _replace_or_keep,
)
from students.services.excel_import.resolvers import (
    _resolve_course,
    _resolve_parent,
    _resolve_teacher,
)


def _reconcile_student_courses(*, student: Student, course_names: list[str], course_cache: dict) -> None:
    for course_name in course_names:
        course = _resolve_course(course_name, course_cache)
        if course is not None:
            StudentCourse.objects.get_or_create(student=student, course=course)

    for enrollment in list(
        StudentCourse.objects.select_related("course").filter(student=student)
    ):
        canonical_name = _normalize_course_name(enrollment.course.name)
        if canonical_name is None:
            enrollment.delete()
            continue

        if canonical_name != enrollment.course.name:
            canonical_course = _resolve_course(canonical_name, course_cache)
            if canonical_course is not None:
                StudentCourse.objects.get_or_create(student=student, course=canonical_course)
            enrollment.delete()


def _create_student_from_row(*, creator: User, row: dict) -> Student:
    from students.services.student_services import student_create

    student = student_create(
        creator=creator,
        full_name=row["full_name"],
        national_id=row["national_id"],
        birthdate=row["birthdate"],
        grade=row["grade"],
        address=row["address"] or "غ. م",
        whatsapp=row["whatsapp"],
        mobile=row["mobile"],
        guardian_name=row["guardian_name"],
        guardian_mobile=row["guardian_mobile"],
        guardian_national_id=row["guardian_national_id"] or "غ. م",
        bank_account_number=row["bank_account_number"] or None,
        bank_account_name=row["bank_account_name"] or None,
        bank_account_type=row["bank_account_type"] or None,
        previous_courses=row["previous_courses"],
        desired_courses=row["desired_courses"],
        health_status=row["health_status"],
        health_note=row["health_note"],
        skills=row["skills"],
        _internal_student_create=True,
    )

    return student


def _update_existing_student(*, student: Student, row: dict) -> Student:
    field_names = [
        "full_name",
        "birthdate",
        "grade",
        "address",
        "whatsapp",
        "mobile",
        "guardian_name",
        "guardian_national_id",
        "guardian_mobile",
        "bank_account_number",
        "bank_account_name",
        "bank_account_type",
        "previous_courses",
        "desired_courses",
        "health_status",
        "health_note",
    ]

    changed_fields: list[str] = []
    for field_name in field_names:
        current_value = getattr(student, field_name)
        next_value, changed = _replace_or_keep(current_value, row[field_name])
        if changed:
            setattr(student, field_name, next_value)
            changed_fields.append(field_name)

    current_skills = student.skills or {}
    next_skills = row["skills"] or {}
    if next_skills and next_skills != current_skills:
        student.skills = next_skills
        changed_fields.append("skills")

    if changed_fields:
        student.full_clean()
        student.save(update_fields=changed_fields + ["updated_at"])

    if row["mobile"] and student.user.phone_number != row["mobile"]:
        student.user.phone_number = row["mobile"]
        student.user.save(update_fields=["phone_number"])

    return student


@transaction.atomic
def excel_bulk_import(*, creator: User, rows: list) -> dict:
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه استيراد الطلاب.")

    created_count = 0
    updated_count = 0
    errors = []

    teacher_cache: dict = {}
    course_cache: dict = {}
    parent_cache: dict = {}

    for idx, raw_row in enumerate(rows, start=1):
        try:
            with transaction.atomic():
                row = _normalize_row(raw_row)

                # Basic validation for required fields in normalization
                if not row.get("full_name") or row.get("full_name") == "غ. م":
                    if not raw_row.get("full_name"):
                        raise ValueError("اسم الطالب مطلوب.")

                student = student_find_by_national_id(national_id=row["national_id"])

                if student is None:
                    orphan = user_find_by_national_id(national_id=row["national_id"])
                    if orphan:
                        has_student = student_exists_for_user(user=orphan)
                        has_teacher = teacher_exists_for_user(user=orphan)
                        orphan_parent = parent_find_by_user(user=orphan)

                        if not has_student and not has_teacher:
                            if orphan_parent is None:
                                orphan.delete()
                            elif not orphan_parent.student_links.exists():
                                orphan_parent.delete()
                                orphan.delete()

                    student = _create_student_from_row(creator=creator, row=row)
                    created_count += 1
                else:
                    student = _update_existing_student(student=student, row=row)
                    updated_count += 1

                # Resolve parent and link
                try:
                    parent = _resolve_parent(
                        guardian_name=row["guardian_name"],
                        guardian_mobile=row["guardian_mobile"],
                        guardian_national_id=row["guardian_national_id"],
                        creator=creator,
                        parent_cache=parent_cache,
                    )
                    if parent is not None:
                        ParentStudentLink.objects.get_or_create(parent=parent, student=student)
                except Exception as p_exc:
                    errors.append({
                        "row": idx,
                        "national_id": row["national_id"],
                        "message": f"تنبيه: فشل ربط ولي الأمر: {_format_exception_message(p_exc)}"
                    })

                # Resolve teacher
                try:
                    teacher = _resolve_teacher(
                        teacher_name=row["teacher_name"],
                        affiliation=row["affiliation"],
                        creator=creator,
                        teacher_cache=teacher_cache,
                    )
                    if teacher is not None and student.teacher_id != teacher.id:
                        student.teacher = teacher
                        student.save(update_fields=["teacher", "updated_at"])
                except Exception as t_exc:
                    errors.append({
                        "row": idx,
                        "national_id": row["national_id"],
                        "message": f"تنبيه: فشل تعيين المحفظ: {_format_exception_message(t_exc)}"
                    })

                # Reconcile courses
                try:
                    _reconcile_student_courses(
                        student=student,
                        course_names=row["course_names"],
                        course_cache=course_cache,
                    )
                except Exception as c_exc:
                    errors.append({
                        "row": idx,
                        "national_id": row["national_id"],
                        "message": f"تنبيه: فشل تحديث الدورات: {_format_exception_message(c_exc)}"
                    })

        except Exception as exc:
            errors.append(
                {
                    "row": idx,
                    "national_id": _clean_text(raw_row.get("national_id")) or None,
                    "message": _format_exception_message(exc),
                }
            )

    return {
        "created_count": created_count,
        "updated_count": updated_count,
        "error_count": len(errors),
        "errors": errors,
    }
