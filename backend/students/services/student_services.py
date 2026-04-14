from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import User, Teacher, Parent, ParentStudentLink
from accounts.services.user_services import user_create
from accounts.utils import normalize_phone
from core.permissions import is_admin_user
from students.models import Student


_GRADE_MAP = {
    "الأول": "1", "الاول": "1", "الثاني": "2", "الثالث": "3", "الرابع": "4",
    "الخامس": "5", "السادس": "6", "السابع": "7", "الثامن": "8",
    "التاسع": "9", "العاشر": "10", "الحادي عشر": "11", "الثاني عشر": "12",
}
_HEALTH_MAP = {
    "ابن شهيد": "martyr_son",
    "مريض": "sick",
    "جريح": "injured",
}


def _normalize_grade(value) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    if not s:
        return ""
    s = s.replace("الصف ", "").replace("صف ", "").strip()
    return _GRADE_MAP.get(s, s)


def _normalize_health(text) -> tuple[str, str]:
    if text is None:
        return "normal", ""
    t = str(text).strip()
    if not t:
        return "normal", ""
    if t in _HEALTH_MAP:
        return _HEALTH_MAP[t], ""
    return "other", t


def _parse_date(raw) -> str:
    if raw is None:
        return ""
    s = str(raw).strip()
    if not s:
        return ""
    # Handle both forward slashes (/) and backslashes (\\)
    # Also handle cases like 12\\12\\2011 from Excel
    if "/" in s or "\\" in s:
        # Replace backslashes with forward slashes for uniform handling
        s = s.replace("\\", "/")
        parts = s.split("/")
        if len(parts) == 3:
            d, m, y = parts
            # Ensure year is 4 digits
            if len(y) == 2:
                y = "20" + y if int(y) < 50 else "19" + y
            return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    return s


def _synthetic_phone(national_id: str) -> str:
    digits = "".join(c for c in str(national_id) if c.isdigit())
    tail = digits[-8:].rjust(8, "0")
    return "05" + tail


@transaction.atomic
def student_create(*, creator: User, **data) -> Student:
    """
    Create a new student. Creates User + Student atomically.
    Admin only (feature 2.1).
    """
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه تسجيل طلاب جدد.")

    # Required fields
    required_fields = ["full_name", "national_id", "birthdate", "grade", "phone_number", "guardian_name", "guardian_mobile"]
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        raise ValidationError({f: "هذا الحقل مطلوب." for f in missing})

    # Check for duplicate national_id
    if Student.objects.filter(national_id=data["national_id"]).exists():
        raise ValidationError({"national_id": "رقم الهوية مسجل مسبقاً."})

    # Create user account
    user = user_create(
        creator=creator,
        phone_number=data["phone_number"],
        first_name=data.get("first_name", data["full_name"].split()[0] if data["full_name"] else ""),
        last_name=data.get("last_name", " ".join(data["full_name"].split()[1:]) if data["full_name"] else ""),
        role="student",
        _internal_student_create=True,
    )

    # Resolve teacher
    teacher = None
    teacher_id = data.get("teacher_id")
    if teacher_id:
        try:
            teacher = Teacher.objects.get(id=teacher_id)
        except Teacher.DoesNotExist:
            raise ValidationError({"teacher_id": "المحفظ غير موجود."})

    student = Student(
        user=user,
        full_name=data["full_name"],
        national_id=data["national_id"],
        birthdate=data["birthdate"],
        grade=data["grade"],
        address=data.get("address", ""),
        whatsapp=data.get("whatsapp", ""),
        mobile=data.get("mobile", ""),
        previous_courses=data.get("previous_courses", ""),
        desired_courses=data.get("desired_courses", ""),
        bank_account_number=data.get("bank_account_number"),
        bank_account_name=data.get("bank_account_name"),
        bank_account_type=data.get("bank_account_type"),
        guardian_name=data["guardian_name"],
        guardian_national_id=data.get("guardian_national_id"),
        guardian_mobile=data["guardian_mobile"],
        teacher=teacher,
        health_status=data.get("health_status", "normal"),
        health_note=data.get("health_note", ""),
        skills=data.get("skills", {}),
    )
    student.full_clean()
    student.save()

    return student


@transaction.atomic
def student_update(*, student: Student, actor: User, data: dict) -> Student:
    """
    Update student data. Admin can update all fields. Teacher limited fields.
    """
    if is_admin_user(actor):
        allowed = [
            "full_name", "national_id", "birthdate", "grade",
            "address", "whatsapp", "health_status", "health_note", "skills",
            "mobile", "previous_courses", "desired_courses",
            "bank_account_number", "bank_account_name", "bank_account_type",
            "guardian_name", "guardian_national_id", "guardian_mobile",
        ]
    elif actor.role == "teacher":
        allowed = ["health_note", "skills"]
    else:
        raise PermissionDenied("ليس لديك صلاحية لتعديل بيانات الطالب.")

    for field, value in data.items():
        if field in allowed:
            setattr(student, field, value)

    student.full_clean()
    student.save()
    return student


@transaction.atomic
def student_deactivate(*, student_id, actor: User) -> Student:
    """
    Soft-delete a student (feature 2.5). Admin only.
    """
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه إيقاف تسجيل الطلاب.")

    from students.selectors.student_selectors import student_get

    student = student_get(student_id=student_id, actor=actor)
    student.is_active = False
    student.save()

    # Also deactivate the user account
    student.user.is_active = False
    student.user.save()

    return student


@transaction.atomic
def student_assign_teacher(*, student_id, teacher_id, actor: User) -> Student:
    """
    Assign or change a student's teacher. Admin only (feature 2.4).
    """
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه تعيين المحفظ.")

    from students.selectors.student_selectors import student_get

    student = student_get(student_id=student_id, actor=actor)

    try:
        teacher = Teacher.objects.get(id=teacher_id)
    except Teacher.DoesNotExist:
        raise ValidationError({"teacher_id": "المحفظ غير موجود."})

    # Check max students
    current_count = Student.objects.filter(teacher=teacher, is_active=True).count()
    if current_count >= teacher.max_students:
        raise ValidationError(
            {"teacher_id": f"المحفظ وصل للحد الأقصى ({teacher.max_students} طالب)."}
        )

    student.teacher = teacher
    student.save()
    return student


@transaction.atomic
def student_link_parent(*, student_id, parent_id, actor: User) -> ParentStudentLink:
    """
    Link a parent to a student (feature 2.6). Admin only.
    """
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه ربط ولي الأمر بالطالب.")

    from students.selectors.student_selectors import student_get

    student = student_get(student_id=student_id, actor=actor)

    try:
        parent = Parent.objects.get(id=parent_id)
    except Parent.DoesNotExist:
        raise ValidationError({"parent_id": "ولي الأمر غير موجود."})

    if ParentStudentLink.objects.filter(parent=parent, student=student).exists():
        raise ValidationError("ولي الأمر مرتبط بهذا الطالب مسبقاً.")

    link = ParentStudentLink(parent=parent, student=student)
    link.full_clean()
    link.save()
    return link


def student_bulk_create(*, creator: User, rows: list) -> dict:
    """
    Bulk-create students from Excel import. Each row is wrapped in its own
    transaction so partial failures don't block the whole import.

    Strategy for phone_number uniqueness: the student User account always uses
    a synthetic phone derived from national_id (guaranteed unique per student),
    while guardian_mobile is used to find-or-create a shared Parent account and
    link it via ParentStudentLink. Students sharing a guardian phone are thus
    linked to the same Parent.
    
    Auto-creates teachers and courses if they don't exist.
    """
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه استيراد الطلاب.")

    # Pre-fetch teachers (and allow auto-creation)
    teacher_by_name = {
        (t.full_name or "").strip(): t
        for t in Teacher.objects.all()
    }
    
    # Pre-fetch courses (and allow auto-creation)
    from courses.models import Course, StudentCourse
    course_by_name = {
        (c.name or "").strip(): c
        for c in Course.objects.all()
    }
    
    # Pre-fetch existing students to avoid duplicates
    existing_national_ids = set(Student.objects.values_list('national_id', flat=True))
    
    # Pre-fetch existing parents by phone number
    existing_parents_by_phone = {
        p.phone_number: p
        for p in Parent.objects.select_related('user').all()
    }

    created, errors = [], []

    for idx, row in enumerate(rows, start=1):
        national_id = str(row.get("national_id", "") or "").strip()
        
        if national_id in existing_national_ids:
            errors.append({
                "row": idx,
                "national_id": national_id,
                "message": "رقم الهوية مسجل مسبقاً.",
            })
            continue

        try:
            with transaction.atomic():
                health_status, health_note = _normalize_health(row.get("health_status"))
                skills_raw = row.get("skills")
                skills = {"description": str(skills_raw)} if skills_raw else {}

                full_name = str(row.get("full_name", "") or "").strip()
                guardian_name = str(row.get("guardian_name", "") or "").strip() or full_name or "غير محدد"
                guardian_mobile = str(row.get("guardian_mobile", "") or "").strip() or _synthetic_phone(national_id)

                data = {
                    "full_name": full_name,
                    "national_id": national_id,
                    "birthdate": _parse_date(row.get("birthdate")),
                    "grade": _normalize_grade(row.get("grade")),
                    "address": str(row.get("address", "") or ""),
                    "whatsapp": str(row.get("whatsapp", "") or ""),
                    "mobile": str(row.get("mobile", "") or ""),
                    "previous_courses": str(row.get("previous_courses", "") or ""),
                    "guardian_name": guardian_name,
                    "guardian_national_id": str(row.get("guardian_national_id", "") or ""),
                    "guardian_mobile": guardian_mobile,
                    "bank_account_number": str(row.get("bank_account_number", "") or "") or None,
                    "bank_account_name": str(row.get("bank_account_name", "") or "") or None,
                    "bank_account_type": str(row.get("bank_account_type", "") or "") or None,
                    "follow_up": str(row.get("follow_up", "") or ""),
                    "health_status": health_status,
                    "health_note": health_note,
                    "skills": skills,
                    "phone_number": _synthetic_phone(national_id),
                }

                # Handle teacher: auto-create if not exists
                teacher_name = str(row.get("teacher_name", "") or "").strip()
                if teacher_name:
                    if teacher_name not in teacher_by_name:
                        # Auto-create teacher if not exists
                        try:
                            teacher_user = user_create(
                                creator=creator,
                                phone_number=_synthetic_phone(national_id + teacher_name),
                                first_name=teacher_name.split()[0] if teacher_name else "",
                                last_name=" ".join(teacher_name.split()[1:]) if len(teacher_name.split()) > 1 else "",
                                role="teacher",
                            )
                            teacher_obj = Teacher.objects.create(
                                user=teacher_user,
                                full_name=teacher_name,
                            )
                            teacher_by_name[teacher_name] = teacher_obj
                        except Exception as e:
                            # If teacher creation fails, skip assigning teacher
                            pass
                    
                    if teacher_name in teacher_by_name:
                        data["teacher_id"] = str(teacher_by_name[teacher_name].id)

                student = student_create(creator=creator, **data)

                guardian_mobile = data["guardian_mobile"].strip()
                guardian_name = data["guardian_name"]
                if guardian_mobile:
                    try:
                        normalized = normalize_phone(guardian_mobile)
                    except ValidationError:
                        normalized = None

                    if normalized:
                        parent = existing_parents_by_phone.get(normalized)
                        if parent is None:
                            parent_user = User.objects.filter(phone_number=normalized).first()
                            if parent_user is None:
                                name_parts = guardian_name.split() if guardian_name else []
                                parent_user = user_create(
                                    creator=creator,
                                    phone_number=normalized,
                                    first_name=name_parts[0] if name_parts else "",
                                    last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "",
                                    role="parent",
                                )
                            parent, _ = Parent.objects.get_or_create(
                                user=parent_user,
                                defaults={
                                    "full_name": guardian_name or parent_user.get_full_name() or normalized,
                                    "phone_number": normalized,
                                },
                            )
                            existing_parents_by_phone[normalized] = parent
                        
                        ParentStudentLink.objects.get_or_create(parent=parent, student=student)

                # Handle courses: auto-create if not exists and enroll student
                courses_raw = row.get("desired_courses", "")
                if courses_raw:
                    course_names = [c.strip() for c in str(courses_raw).split(",") if c.strip()]
                    for course_name in course_names:
                        if course_name not in course_by_name:
                            # Auto-create course if not exists
                            try:
                                course_obj = Course.objects.create(
                                    name=course_name,
                                    description="",
                                )
                                course_by_name[course_name] = course_obj
                            except Exception as e:
                                # If course creation fails, skip this course
                                pass
                        
                        if course_name in course_by_name:
                            StudentCourse.objects.get_or_create(
                                student=student,
                                course=course_by_name[course_name],
                            )

                created.append(str(student.id))
                existing_national_ids.add(national_id)
        except ValidationError as e:
            errors.append({
                "row": idx,
                "national_id": national_id,
                "message": str(e.detail) if hasattr(e, "detail") else str(e),
            })
        except Exception as e:
            errors.append({
                "row": idx,
                "national_id": national_id,
                "message": str(e),
            })

    return {
        "created_count": len(created),
        "error_count": len(errors),
        "errors": errors,
    }
