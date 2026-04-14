"""
Enhanced Excel import service for bulk student creation with automatic teacher and course creation.

Features:
- Auto-creates teachers if they don't exist
- Auto-creates courses if they don't exist
- Auto-creates parents and links them to students
- Handles all student data fields completely
- Provides detailed error reporting per row
"""
from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import User, Teacher, Parent, ParentStudentLink
from accounts.services.user_services import user_create
from accounts.utils import normalize_phone
from core.permissions import is_admin_user
from students.models import Student
from courses.models import Course, StudentCourse


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
    "awqaf": "awqaf",
    "dar_quran": "dar_quran",
}


def _normalize_grade(value) -> str:
    """Normalize grade value to standard format."""
    if value is None:
        return ""
    s = str(value).strip()
    if not s:
        return ""
    s = s.replace("الصف ", "").replace("صف ", "").strip()
    return _GRADE_MAP.get(s, s)


def _normalize_health(text) -> tuple[str, str]:
    """Normalize health status to enum and extract note."""
    if text is None:
        return "normal", ""
    t = str(text).strip()
    if not t:
        return "normal", ""
    if t in _HEALTH_MAP:
        return _HEALTH_MAP[t], ""
    return "other", t


def _parse_date(raw) -> str:
    """Parse date from various formats (DD/MM/YYYY, DD\\MM\\YYYY, etc)."""
    if raw is None:
        return ""
    s = str(raw).strip()
    if not s:
        return ""
    # Handle both forward slashes (/) and backslashes (\\)
    if "/" in s or "\\" in s:
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
    """Generate synthetic phone number from national ID."""
    digits = "".join(c for c in str(national_id) if c.isdigit())
    tail = digits[-8:].rjust(8, "0")
    return "05" + tail


def _get_or_create_teacher(teacher_name: str, creator: User, teacher_cache: dict) -> Teacher:
    """
    Get existing teacher or create new one if not exists.
    
    Args:
        teacher_name: Full name of teacher
        creator: User creating the teacher
        teacher_cache: Cache dictionary for teachers
    
    Returns:
        Teacher instance or None if creation fails
    """
    if not teacher_name or not teacher_name.strip():
        return None
    
    teacher_name = teacher_name.strip()
    
    # Check cache first
    if teacher_name in teacher_cache:
        return teacher_cache[teacher_name]
    
    # Check database
    existing = Teacher.objects.filter(full_name__iexact=teacher_name).first()
    if existing:
        teacher_cache[teacher_name] = existing
        return existing
    
    # Auto-create teacher
    try:
        name_parts = teacher_name.split()
        phone = _synthetic_phone(teacher_name)
        
        teacher_user = user_create(
            creator=creator,
            phone_number=phone,
            first_name=name_parts[0] if name_parts else "",
            last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "",
            role="teacher",
        )
        
        teacher = Teacher.objects.create(
            user=teacher_user,
            full_name=teacher_name,
        )
        
        teacher_cache[teacher_name] = teacher
        return teacher
    except Exception as e:
        # Log error but don't fail the import
        print(f"Failed to create teacher '{teacher_name}': {str(e)}")
        return None


def _get_or_create_course(course_name: str, course_cache: dict) -> Course:
    """
    Get existing course or create new one if not exists.
    
    Args:
        course_name: Name of course
        course_cache: Cache dictionary for courses
    
    Returns:
        Course instance or None if creation fails
    """
    if not course_name or not course_name.strip():
        return None
    
    course_name = course_name.strip()
    
    # Check cache first
    if course_name in course_cache:
        return course_cache[course_name]
    
    # Check database
    existing = Course.objects.filter(name__iexact=course_name).first()
    if existing:
        course_cache[course_name] = existing
        return existing
    
    # Auto-create course
    try:
        course = Course.objects.create(
            name=course_name,
            description="",
        )
        course_cache[course_name] = course
        return course
    except Exception as e:
        # Log error but don't fail the import
        print(f"Failed to create course '{course_name}': {str(e)}")
        return None


def _get_or_create_parent(guardian_name: str, guardian_mobile: str, creator: User, parent_cache: dict) -> Parent:
    """
    Get existing parent or create new one if not exists.
    
    Args:
        guardian_name: Full name of guardian
        guardian_mobile: Mobile number of guardian
        creator: User creating the parent
        parent_cache: Cache dictionary for parents
    
    Returns:
        Parent instance or None if creation fails
    """
    if not guardian_mobile or not guardian_mobile.strip():
        return None
    
    try:
        normalized_phone = normalize_phone(guardian_mobile)
    except ValidationError:
        return None
    
    # Check cache first
    if normalized_phone in parent_cache:
        return parent_cache[normalized_phone]
    
    # Check database
    existing_parent = Parent.objects.filter(phone_number=normalized_phone).first()
    if existing_parent:
        parent_cache[normalized_phone] = existing_parent
        return existing_parent
    
    # Create new parent
    try:
        existing_user = User.objects.filter(phone_number=normalized_phone).first()
        
        if not existing_user:
            name_parts = guardian_name.split() if guardian_name else []
            existing_user = user_create(
                creator=creator,
                phone_number=normalized_phone,
                first_name=name_parts[0] if name_parts else "",
                last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "",
                role="parent",
            )
        
        parent = Parent.objects.create(
            user=existing_user,
            full_name=guardian_name or existing_user.get_full_name() or normalized_phone,
            phone_number=normalized_phone,
        )
        
        parent_cache[normalized_phone] = parent
        return parent
    except Exception as e:
        print(f"Failed to create parent '{guardian_name}': {str(e)}")
        return None


@transaction.atomic
def excel_bulk_import(*, creator: User, rows: list) -> dict:
    """
    Bulk-import students from Excel with complete data handling.
    
    Features:
    - Auto-creates teachers if they don't exist
    - Auto-creates courses if they don't exist
    - Auto-creates parents and links them to students
    - Handles all student data fields completely
    - Provides detailed error reporting per row
    
    Args:
        creator: User performing the import
        rows: List of dictionaries representing Excel rows
    
    Returns:
        Dictionary with:
        - created_count: Number of successfully created students
        - error_count: Number of failed rows
        - errors: List of error details per row
    """
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه استيراد الطلاب.")
    
    # Initialize caches
    teacher_cache = {}
    course_cache = {}
    parent_cache = {}
    existing_national_ids = set(Student.objects.values_list('national_id', flat=True))
    
    created = []
    errors = []
    
    for idx, row in enumerate(rows, start=1):
        national_id = str(row.get("national_id", "") or "").strip()
        
        # Check for duplicate national ID
        if national_id in existing_national_ids:
            errors.append({
                "row": idx,
                "national_id": national_id,
                "message": "رقم الهوية مسجل مسبقاً.",
            })
            continue
        
        try:
            with transaction.atomic():
                # Parse and normalize all fields
                full_name = str(row.get("full_name", "") or "").strip()
                guardian_name = str(row.get("guardian_name", "") or "").strip() or full_name or "غير محدد"
                guardian_mobile = str(row.get("guardian_mobile", "") or "").strip() or _synthetic_phone(national_id)
                
                health_status, health_note = _normalize_health(row.get("health_status"))
                skills_raw = row.get("skills")
                skills = {"description": str(skills_raw)} if skills_raw else {}
                
                # Create student data dictionary
                student_data = {
                    "full_name": full_name,
                    "national_id": national_id,
                    "birthdate": _parse_date(row.get("birthdate")),
                    "grade": _normalize_grade(row.get("grade")),
                    "address": str(row.get("address", "") or "").strip(),
                    "whatsapp": str(row.get("whatsapp", "") or "").strip(),
                    "mobile": str(row.get("mobile", "") or "").strip(),
                    "previous_courses": str(row.get("previous_courses", "") or "").strip(),
                    "desired_courses": str(row.get("desired_courses", "") or "").strip(),
                    "bank_account_number": str(row.get("bank_account_number", "") or "") or None,
                    "bank_account_name": str(row.get("bank_account_name", "") or "") or None,
                    "bank_account_type": str(row.get("bank_account_type", "") or "") or None,
                    "guardian_name": guardian_name,
                    "guardian_national_id": str(row.get("guardian_national_id", "") or "").strip() or None,
                    "guardian_mobile": guardian_mobile,
                    "health_status": health_status,
                    "health_note": health_note,
                    "skills": skills,
                    "phone_number": _synthetic_phone(national_id),
                }
                
                # Handle teacher: auto-create if not exists
                teacher_name = str(row.get("teacher_name", "") or "").strip()
                if teacher_name:
                    teacher = _get_or_create_teacher(teacher_name, creator, teacher_cache)
                    if teacher:
                        student_data["teacher_id"] = str(teacher.id)
                
                # Create student using the existing student_create function
                from students.services.student_services import student_create
                student = student_create(creator=creator, **student_data)
                
                # Link parent if guardian mobile exists
                if guardian_mobile:
                    parent = _get_or_create_parent(guardian_name, guardian_mobile, creator, parent_cache)
                    if parent:
                        ParentStudentLink.objects.get_or_create(parent=parent, student=student)
                
                # Handle courses: auto-create if not exists and enroll student
                courses_raw = row.get("desired_courses", "")
                if courses_raw:
                    course_names = [c.strip() for c in str(courses_raw).split(",") if c.strip()]
                    for course_name in course_names:
                        course = _get_or_create_course(course_name, course_cache)
                        if course:
                            StudentCourse.objects.get_or_create(
                                student=student,
                                course=course,
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
        "created_ids": created,
        "errors": errors,
    }
