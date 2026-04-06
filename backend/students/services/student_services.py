from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from backend.accounts.models import User, Teacher, Parent, ParentStudentLink
from backend.accounts.services.user_services import user_create
from backend.students.models import Student


@transaction.atomic
def student_create(*, creator: User, **data) -> Student:
    """
    Create a new student. Creates User + Student atomically.
    Admin only (feature 2.1).
    """
    if creator.role != "admin":
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
        username=data.get("username", data["phone_number"]),
        first_name=data.get("first_name", data["full_name"].split()[0] if data["full_name"] else ""),
        last_name=data.get("last_name", " ".join(data["full_name"].split()[1:]) if data["full_name"] else ""),
        password=data.get("password"),
        role="student",
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
    if actor.role == "admin":
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
    if actor.role != "admin":
        raise PermissionDenied("فقط المدير يمكنه إيقاف تسجيل الطلاب.")

    from backend.students.selectors.student_selectors import student_get

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
    if actor.role != "admin":
        raise PermissionDenied("فقط المدير يمكنه تعيين المحفظ.")

    from backend.students.selectors.student_selectors import student_get

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
    if actor.role != "admin":
        raise PermissionDenied("فقط المدير يمكنه ربط ولي الأمر بالطالب.")

    from backend.students.selectors.student_selectors import student_get

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
