from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import User, Parent, ParentStudentLink
from teacher.models import Teacher
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
            # Disambiguate DD/MM vs MM/DD: Arabic data is usually DD/MM, but
            # Excel sometimes formats cells as m/d/yyyy and xlsx.js returns
            # that string verbatim. If the "month" slot is > 12 and the "day"
            # slot is ≤ 12, swap them so the date becomes valid.
            try:
                if int(m) > 12 and int(d) <= 12:
                    d, m = m, d
            except ValueError:
                pass
            # Ensure year is 4 digits
            if len(y) == 2:
                y = "20" + y if int(y) < 50 else "19" + y
            # Reject garbage years (e.g. '9/10/200169' typo in the Excel).
            # Returning "" lets the caller fall back to the placeholder dob
            # instead of failing the whole row over a single bad cell.
            if len(y) != 4 or not y.isdigit():
                return ""
            return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    # ISO-like fallthrough (YYYY-M-D or YYYY-MM-DD, possibly unpadded)
    if "-" in s:
        parts = s.split("-")
        if len(parts) == 3 and len(parts[0]) == 4 and parts[0].isdigit():
            y, m, d = parts
            return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    return s


def _synthetic_phone(national_id: str) -> str:
    digits = "".join(c for c in str(national_id) if c.isdigit())
    tail = digits[-8:].rjust(8, "0")
    return "05" + tail


@transaction.atomic
def student_create(*, creator: User, id=None, **data) -> Student:
    """
    Create a new student. Creates User + Student atomically.
    Admin only (feature 2.1). Accepts optional `id` minted by an offline
    client so the Student UUID round-trips stably through sync/push.
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

    # Check for duplicate national_id (canonical uniqueness lives on User).
    if User.objects.filter(national_id=data["national_id"]).exists():
        raise ValidationError({"national_id": "رقم الهوية مسجل مسبقاً."})

    # Create user account
    # Use the student's actual mobile as phone_number; fall back to a synthetic
    # 05XXXXXXXX number derived from national_id when no real mobile is provided.
    raw_mobile = data.get("mobile") or data.get("phone_number") or ""
    try:
        student_phone = normalize_phone(str(raw_mobile).strip()) if str(raw_mobile).strip() else ""
    except Exception:
        student_phone = ""
    if not student_phone:
        student_phone = _synthetic_phone(data["national_id"])

    user = user_create(
        creator=creator,
        phone_number=student_phone,
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

    student_kwargs = dict(
        user=user,
        full_name=data["full_name"],
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
        current_surah=data.get("current_surah", ""),
        current_juz=data.get("current_juz"),
        memorized_verses=data.get("memorized_verses", 0),
    )
    if id is not None:
        student_kwargs["id"] = id
    student = Student(**student_kwargs)
    student.full_clean()
    student.save()

    return student


@transaction.atomic
def student_update(*, student: Student, actor: User, data: dict) -> Student:
    """
    Update student data. Admin only — a teacher cannot write to a student's
    record directly; they must submit a `StudentChangeRequest` (action=update)
    for admin approval, which this function then applies on the admin's behalf.
    """
    if not is_admin_user(actor):
        raise PermissionDenied(
            "لا يمكنك تعديل بيانات الطالب مباشرة. يرجى إرسال طلب تعديل بانتظار موافقة الإدارة."
        )

    allowed = [
        # Personal Information
        "full_name", "birthdate", "grade",
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
        # Quran Progress
        "current_surah", "current_juz", "memorized_verses",
    ]

    # national_id is stored on the related User (USERNAME_FIELD). Route it there.
    new_national_id = data.get("national_id")
    if new_national_id and new_national_id != student.user.national_id:
        if User.objects.filter(national_id=new_national_id).exclude(pk=student.user_id).exists():
            raise ValidationError({"national_id": "رقم الهوية مسجل مسبقاً."})
        student.user.national_id = new_national_id
        student.user.save(update_fields=["national_id"])

    # Update allowed fields on the Student itself
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
    Writes a Tombstone in the same transaction so offline clients learn
    of the deletion on the next sync pull (STU-04 semantics preserved).
    """
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه حذف الطلاب.")

    from students.selectors.student_selectors import student_get
    from sync.models import Tombstone
    from sync.services.tombstone_service import tombstone_write

    student = student_get(student_id=student_id, actor=actor)
    user = student.user
    deleted_uuid = student.id

    # Deleting the user cascades to the student profile and all its
    # FK children (weekly plans, daily records, evaluations, etc.).
    user.delete()

    tombstone_write(
        resource=Tombstone.Resource.STUDENT,
        resource_uuid=deleted_uuid,
        actor=actor,
        scope_user_id=None,  # broadcast: anyone who cached the student learns it's gone
    )


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
def student_unassign_teacher(*, student_id, actor: User) -> Student:
    """
    Remove a student's teacher assignment. Admin only.
    """
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه إزالة تعيين المحفظ.")

    from students.selectors.student_selectors import student_get

    student = student_get(student_id=student_id, actor=actor)
    student.teacher = None
    student.save()
    return student


@transaction.atomic
def student_link_parent(*, student_id, parent_id, actor: User, id=None) -> ParentStudentLink:
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

    link_kwargs = {"parent": parent, "student": student}
    if id is not None:
        link_kwargs["id"] = id
    link = ParentStudentLink(**link_kwargs)
    link.full_clean()
    link.save()
    return link


@transaction.atomic
def student_unlink_parent(*, link: ParentStudentLink, actor: User) -> None:
    """Remove a parent-student link. Admin only. Writes a tombstone."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه إلغاء ربط ولي الأمر بالطالب.")

    from sync.models import Tombstone
    from sync.services.tombstone_service import tombstone_write

    deleted_uuid = link.id
    link.delete()
    tombstone_write(
        resource=Tombstone.Resource.PARENT_STUDENT_LINK,
        resource_uuid=deleted_uuid,
        actor=actor,
        scope_user_id=None,
    )


def student_bulk_create(*, creator: User, rows: list) -> dict:
    """
    Bulk-create or repair students from Excel import.
    The canonical normalization and reconciliation logic lives in
    students.services.excel_import_service.
    """
    from students.services.excel_import_service import excel_bulk_import

    return excel_bulk_import(creator=creator, rows=rows)


@transaction.atomic
def student_set_review_interval(*, student_id, days: int, actor: User) -> Student:
    """Update a student's review rotation interval (days). Teacher-of-student or admin."""
    if days is None or days < 1 or days > 90:
        raise ValidationError({"days": "يجب أن تكون الفترة بين 1 و 90 يوماً."})

    from students.selectors.student_selectors import student_get

    student = student_get(student_id=student_id, actor=actor)

    if not is_admin_user(actor):
        if actor.role != "teacher" or not hasattr(actor, "teacher_profile"):
            raise PermissionDenied("ليس لديك صلاحية لتعديل فترة المراجعة.")
        if student.teacher_id != actor.teacher_profile.id:
            raise PermissionDenied("لا يمكنك تعديل طالب ليس في حلقتك.")

    student.review_interval_days = int(days)
    student.save(update_fields=["review_interval_days"])
    return student
