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
_AFFILIATION_MAP = {
    "أوقاف": "awqaf",
    "دار القرآن": "dar_quran",
    "شيخ التباعية": "sheikh_tabaea",
    "awqaf": "awqaf",
    "dar_quran": "dar_quran",
    "sheikh_tabaea": "sheikh_tabaea",
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
    # Handle both forward slashes (/) and backslashes (\)
    # Also handle cases like 12\12\2011 from Excel
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

    # Required fields for manual creation
    # During bulk import, we allow missing fields by filling them with "غ. م" in the caller
    # but national_id and full_name are still conceptually required.
    required_fields = ["full_name", "national_id", "phone_number", "guardian_name", "guardian_mobile"]
    
    # If this is an internal student creation (like from bulk import), we don't enforce these strictly
    # as the caller (bulk_create) already provides defaults like "غ. م"
    if not data.get("_internal_student_create"):
        missing = [f for f in required_fields if not data.get(f)]
        if missing:
            raise ValidationError({f: "هذا الحقل مطلوب." for f in missing})
    
    # Handle birthdate separately if missing (Django DateField cannot be empty string)
    birthdate = data.get("birthdate")
    if not birthdate:
        # For bulk import where birthdate might be missing, we use a placeholder 
        # but the user sees "غ. م" if we could store it in a char field.
        # Since it's a DateField, we'll use a very old date as a technical placeholder.
        birthdate = "1900-01-01"

    # Check for duplicate national_id
    if Student.objects.filter(national_id=data["national_id"]).exists():
        raise ValidationError({"national_id": "رقم الهوية مسجل مسبقاً."})

    # Create user account
    # Use national_id as phone_number (username) and pass national_id for password logic
    user = user_create(
        creator=creator,
        phone_number=data["national_id"],
        national_id=data["national_id"],
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
        birthdate=birthdate,
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
        # Admin can update all fields
        allowed = [
            # Personal Information
            "full_name", "national_id", "birthdate", "grade",
            # Contact Information
            "address", "whatsapp", "mobile", "phone_number",
            # Academic Information
            "previous_courses", "desired_courses",
            # Bank Account Information
            "bank_account_number", "bank_account_name", "bank_account_type",
            # Guardian Information
            "guardian_name", "guardian_national_id", "guardian_mobile",
            # Health and Skills
            "health_status", "health_note", "skills",
        ]
    elif actor.role == "teacher":
        # Teachers can only update health and skills notes
        allowed = ["health_note", "skills"]
    else:
        raise PermissionDenied("ليس لديك صلاحية لتعديل بيانات الطالب.")

    # Update allowed fields
    for field, value in data.items():
        if field in allowed:
            setattr(student, field, value)

    student.full_clean()
    student.save()
    return student


@transaction.atomic
def student_delete(*, student_id, actor: User):
    """
    Hard-delete a student and their user account. Admin only.
    """
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه حذف الطلاب.")

    from students.selectors.student_selectors import student_get

    student = student_get(student_id=student_id, actor=actor)
    user = student.user
    
    # Deleting the user will cascade to the student profile
    user.delete()


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
    current_count = Student.objects.filter(teacher=teacher).count()
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
    Bulk-create or update students from Excel import.
    
    Rules:
    1. Student Check: If national_id exists, skip creation but proceed to link guardian/courses.
    2. Guardian Linking: Find or create Parent by guardian_mobile and link to student.
    3. Course Enrollment: Find or create Course by name and enroll student.
    4. Teacher Assignment: Resolve Teacher by name and assign to student.
    """
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه استيراد الطلاب.")

    from courses.models import Course, StudentCourse
    
    created_count = 0
    updated_count = 0
    errors = []

    for idx, row in enumerate(rows, start=1):
        try:
            with transaction.atomic():
                national_id = str(row.get("national_id", "") or "").strip()
                if not national_id:
                    raise ValidationError("رقم الهوية مطلوب.")

                # 1. Student Check (Duplicate Prevention)
                student = Student.objects.filter(national_id=national_id).first()
                is_new = False
                
                if not student:
                    is_new = True
                    full_name = str(row.get("full_name", "") or "").strip()
                    birthdate = _parse_date(row.get("birthdate"))
                    grade = _normalize_grade(row.get("grade"))
                    guardian_mobile = normalize_phone(str(row.get("guardian_mobile", "") or "").strip())
                    
                    # Create student using student_create logic
                    # Use "غ. م" (غير معروف) for missing textual fields
                    # Use national_id as phone_number (username)
                    student = student_create(
                        creator=creator,
                        full_name=full_name or "غ. م",
                        national_id=national_id,
                        birthdate=birthdate or None,  # Will handle null in student_create if needed
                        grade=grade or "غ. م",
                        phone_number=national_id,
                        guardian_name=str(row.get("guardian_name", "") or "").strip() or "غ. م",
                        guardian_mobile=guardian_mobile or _synthetic_phone(national_id),
                        guardian_national_id=str(row.get("guardian_national_id", "") or "").strip() or "غ. م",
                        address=str(row.get("address", "") or "").strip() or "غ. م",
                        whatsapp=str(row.get("whatsapp", "") or "").strip() or "غ. م",
                        mobile=str(row.get("mobile", "") or "").strip() or "غ. م",
                        bank_account_number=str(row.get("bank_account_number", "") or "").strip() or "غ. م",
                        bank_account_name=str(row.get("bank_account_name", "") or "").strip() or "غ. م",
                        bank_account_type=str(row.get("bank_account_type", "") or "").strip() or "غ. م",
                        previous_courses=str(row.get("previous_courses", "") or "").strip() or "غ. م",
                        desired_courses=str(row.get("desired_courses", "") or "").strip() or "غ. م",
                        health_status=_normalize_health(row.get("health_status"))[0],
                        health_note=_normalize_health(row.get("health_status"))[1],
                        _internal_student_create=True,
                    )
                    created_count += 1
                else:
                    updated_count += 1

                # 2. Guardian/Parent Linking (Find or Create)
                guardian_mobile = normalize_phone(str(row.get("guardian_mobile", "") or "").strip())
                if guardian_mobile:
                    parent_user = User.objects.filter(phone_number=guardian_mobile, role="parent").first()
                    if not parent_user:
                        # Create new Parent User and Profile
                        parent_user = user_create(
                            creator=creator,
                            phone_number=guardian_mobile,
                            first_name=str(row.get("guardian_name", "") or "ولي").strip(),
                            last_name="أمر",
                            role="parent"
                        )
                        parent = Parent.objects.create(
                            user=parent_user,
                            full_name=str(row.get("guardian_name", "") or "ولي أمر").strip(),
                            phone_number=guardian_mobile
                        )
                    else:
                        parent = parent_user.parent_profile
                    
                    # Link student to parent
                    ParentStudentLink.objects.get_or_create(parent=parent, student=student)

                # 3. Course Enrollment (Assign to Existing)
                courses_raw = row.get("desired_courses") or row.get("previous_courses")
                if courses_raw:
                    course_names = [c.strip() for c in str(courses_raw).split(",") if c.strip()]
                    for name in course_names:
                        course, _ = Course.objects.get_or_create(name=name)
                        StudentCourse.objects.get_or_create(student=student, course=course)

                # 4. Teacher Assignment (Find or Create)
                teacher_name = str(row.get("teacher_name", "") or "").strip()
                if teacher_name:
                    teacher = Teacher.objects.filter(full_name__icontains=teacher_name).first()
                    if not teacher:
                        # If teacher not found, create a new one
                        # We need a unique national_id for the teacher user. 
                        # Using a hash of the name or a synthetic ID.
                        import hashlib
                        teacher_id_hash = hashlib.md5(teacher_name.encode()).hexdigest()[:10]
                        synthetic_national_id = f"T-{teacher_id_hash}"
                        
                        from accounts.services.user_services import teacher_create
                        affiliation_raw = str(row.get("affiliation", "") or "").strip()
                        affiliation = _AFFILIATION_MAP.get(affiliation_raw, affiliation_raw)
                        
                        try:
                            teacher = teacher_create(
                                creator=creator,
                                national_id=synthetic_national_id,
                                full_name=teacher_name,
                                first_name=teacher_name.split()[0],
                                last_name=" ".join(teacher_name.split()[1:]) if len(teacher_name.split()) > 1 else "محفظ",
                                affiliation=affiliation,
                            )
                        except Exception:
                            # If creation fails (e.g. duplicate synthetic ID), skip teacher assignment
                            teacher = None
                    
                    if teacher:
                        student.teacher = teacher
                        student.save()

        except Exception as e:
            errors.append({
                "row": idx,
                "national_id": row.get("national_id"),
                "message": str(e)
            })

    return {
        "created_count": created_count,
        "updated_count": updated_count,
        "error_count": len(errors),
        "errors": errors,
    }
