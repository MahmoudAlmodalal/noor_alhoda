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
    Get existing teacher by exact name, or create a new one if not found.
    """
    if not teacher_name or not teacher_name.strip():
        return None

    teacher_name = teacher_name.strip()

    # Check cache first
    if teacher_name in teacher_cache:
        return teacher_cache[teacher_name]

    # Check database with exact match (icontains could match the wrong teacher)
    existing = Teacher.objects.filter(full_name__iexact=teacher_name).first()
    if existing:
        teacher_cache[teacher_name] = existing
        return existing

    # Auto-create teacher
    try:
        import hashlib
        name_hash = hashlib.md5(teacher_name.encode()).hexdigest()[:10]
        # national_id must not contain "-" (fails Django char validation on some setups)
        synthetic_national_id = f"T{name_hash}"
        phone = _synthetic_phone(name_hash)

        name_parts = teacher_name.split()
        teacher_user = user_create(
            creator=creator,
            national_id=synthetic_national_id,
            phone_number=phone,
            first_name=name_parts[0] if name_parts else teacher_name,
            last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "محفظ",
            role="teacher",
        )

        teacher = Teacher.objects.create(
            user=teacher_user,
            full_name=teacher_name,
        )

        teacher_cache[teacher_name] = teacher
        return teacher
    except Exception as e:
        # Might be a race condition duplicate — try one final fetch
        existing = Teacher.objects.filter(full_name__iexact=teacher_name).first()
        if existing:
            teacher_cache[teacher_name] = existing
            return existing
        print(f"Failed to create teacher '{teacher_name}': {e}")
        return None


def _get_or_create_course(course_name: str, course_cache: dict) -> Course:
    """
    Get existing course or create new one if not exists.
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
        print(f"Failed to create course '{course_name}': {str(e)}")
        return None


def _get_or_create_parent(guardian_name: str, guardian_mobile: str, creator: User, parent_cache: dict) -> Parent:
    """
    Get existing parent or create new one if not exists.
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
    Uses the intelligent logic from student_services.student_bulk_create.
    """
    from students.services.student_services import student_bulk_create
    return student_bulk_create(creator=creator, rows=rows)
