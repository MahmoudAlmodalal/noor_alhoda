"""
Canonical Excel import service for student bulk creation and repair.
"""
import hashlib
import re

from django.db import transaction
from rest_framework.exceptions import PermissionDenied

from accounts.models import Parent, ParentStudentLink, Teacher, User
from accounts.services.user_services import teacher_create, user_create
from accounts.utils import normalize_phone
from core.permissions import is_admin_user
from courses.models import Course, StudentCourse
from students.models import Student


_GRADE_MAP = {
    "الأول": "1",
    "الاول": "1",
    "الثاني": "2",
    "الثالث": "3",
    "الرابع": "4",
    "الخامس": "5",
    "السادس": "6",
    "السابع": "7",
    "الثامن": "8",
    "التاسع": "9",
    "العاشر": "10",
    "الحادي عشر": "11",
    "الثاني عشر": "12",
    "حادي العشر": "11",
    "عاشر": "10",
    "التوجيهي": "12",
    "توجيهي": "12",
}

_AFFILIATION_ALIASES = {
    "أوقاف": "awqaf",
    "اوقاف": "awqaf",
    "awqaf": "awqaf",
    "دار القرآن": "dar_quran",
    "دار القران": "dar_quran",
    "دار القراءن": "dar_quran",
    "دار القؤان": "dar_quran",
    "دارالقرآن": "dar_quran",
    "دارالقراءن": "dar_quran",
    "dar_quran": "dar_quran",
    "شيخ التباعية": "sheikh_tabaea",
    "شيخ التباعيه": "sheikh_tabaea",
    "sheikh_tabaea": "sheikh_tabaea",
}

_COURSE_ALIASES = {
    "النورانية": "النورانية",
    "النوارنية": "النورانية",
    "تمهيدية": "تمهيدية",
    "تاهيدية": "تمهيدية",
    "تاهيلية": "تأهيلية",
    "تأهيلية": "تأهيلية",
    "تاهيل سند": "تأهيل سند",
    "تأهيل سند": "تأهيل سند",
    "العليا": "العليا",
    "عليا": "العليا",
}

_PLACEHOLDER_VALUES = {
    "",
    "-",
    "—",
    "غ. م",
    "غ.م",
    "لايوجد",
    "لا يوجد",
    "بدون",
    "none",
    "null",
    "n/a",
}

_HEALTH_TOKENS = (
    ("ابن شهيد", "martyr_son"),
    ("جريح", "injured"),
    ("مريض", "sick"),
)

_SKILL_ALIASES = {
    "quran": ("قراءة القرآن", "قران كريم", "قرآن", "القران", "القرآن"),
    "nasheed": ("انشاد", "إنشاد", "نشيد"),
    "poetry": ("شعر", "الشعر"),
}


def _normalize_arabic_key(value) -> str:
    if value is None:
        return ""

    text = str(value).strip().lower()
    if not text:
        return ""

    replacements = {
        "أ": "ا",
        "إ": "ا",
        "آ": "ا",
        "ى": "ي",
        "ؤ": "و",
        "ئ": "ي",
        "ة": "ه",
        "ـ": "",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)

    text = re.sub(r"[\s\-_/\\،,؛:()]+", "", text)
    return text


def _clean_text(value) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip())


def _is_placeholder_text(value) -> bool:
    if value is None:
        return True

    cleaned = _clean_text(value)
    if not cleaned:
        return True

    return _normalize_arabic_key(cleaned) in {
        _normalize_arabic_key(item) for item in _PLACEHOLDER_VALUES
    }


def _normalize_grade(value) -> str:
    if value is None:
        return ""

    text = _clean_text(value)
    if not text:
        return ""

    text = text.replace("الصف ", "").replace("صف ", "").strip()
    return _GRADE_MAP.get(text, text)


def _parse_date(raw) -> str:
    if raw is None:
        return ""

    text = _clean_text(raw)
    if not text:
        return ""

    if "/" in text or "\\" in text:
        text = text.replace("\\", "/")
        parts = text.split("/")
        if len(parts) == 3:
            day, month, year = parts
            try:
                if int(month) > 12 and int(day) <= 12:
                    day, month = month, day
            except ValueError:
                pass

            if len(year) == 2 and year.isdigit():
                year = "20" + year if int(year) < 50 else "19" + year

            if len(year) != 4 or not year.isdigit():
                return ""

            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    if "-" in text:
        parts = text.split("-")
        if len(parts) == 3 and len(parts[0]) == 4 and parts[0].isdigit():
            year, month, day = parts
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    return text


def _synthetic_phone(seed: str) -> str:
    digits = "".join(char for char in str(seed) if char.isdigit())
    tail = digits[-8:].rjust(8, "0")
    return "05" + tail


def _safe_phone(value, *, fallback: str = "") -> str:
    text = _clean_text(value)
    if not text:
        return fallback

    try:
        return normalize_phone(text)
    except Exception:
        digits = "".join(char for char in text if char.isdigit())
        if not digits:
            return fallback
        if digits.startswith("970") and len(digits) >= 12:
            digits = "0" + digits[-9:]
        elif len(digits) == 9 and not digits.startswith("0"):
            digits = "0" + digits
        return digits[:15]


def _split_text_list(value) -> list[str]:
    text = _clean_text(value)
    if not text:
        return []

    return [part.strip() for part in re.split(r"[/\\,\n،]+", text) if part.strip()]


def _split_health_tokens(value) -> list[str]:
    text = _clean_text(value)
    if not text:
        return []

    return [part.strip() for part in re.split(r"[/\\,\n،\-]+", text) if part.strip()]


def _normalize_affiliation(value) -> str:
    text = _clean_text(value)
    if not text:
        return ""

    normalized = _normalize_arabic_key(text)
    for alias, code in _AFFILIATION_ALIASES.items():
        if normalized == _normalize_arabic_key(alias):
            return code

    return ""


def _match_health_status(token: str) -> str:
    normalized = _normalize_arabic_key(token)
    for alias, status in _HEALTH_TOKENS:
        alias_key = _normalize_arabic_key(alias)
        if normalized == alias_key or alias_key in normalized:
            return status
    return ""


def _normalize_health(text) -> tuple[str, str]:
    raw = _clean_text(text)
    if not raw:
        return "normal", ""

    primary_status = ""
    notes: list[str] = []

    for token in _split_health_tokens(raw):
        status = _match_health_status(token)
        if status and not primary_status:
            primary_status = status
            continue

        if token:
            notes.append(token)

    if primary_status:
        return primary_status, "، ".join(dict.fromkeys(notes))

    return "other", raw


def _parse_skills(value) -> dict:
    skills = {
        "quran": False,
        "nasheed": False,
        "poetry": False,
        "other": False,
    }

    raw = _clean_text(value)
    if not raw or _is_placeholder_text(raw):
        return skills

    other_values: list[str] = []
    for token in [part.strip() for part in re.split(r"[/\\,\n،\-]+", raw) if part.strip()]:
        normalized = _normalize_arabic_key(token)
        matched = False
        for skill_key, aliases in _SKILL_ALIASES.items():
            if any(_normalize_arabic_key(alias) in normalized for alias in aliases):
                skills[skill_key] = True
                matched = True
                break

        if not matched and not _is_placeholder_text(token):
            other_values.append(token)

    if other_values:
        skills["other"] = True
        skills["other_text"] = "، ".join(dict.fromkeys(other_values))

    return skills


def _normalize_course_name(raw) -> str | None:
    text = _clean_text(raw)
    if not text or _is_placeholder_text(text):
        return None

    normalized = _normalize_arabic_key(text)
    for alias, canonical in _COURSE_ALIASES.items():
        if normalized == _normalize_arabic_key(alias):
            return canonical

    return text


def _parse_course_names(raw) -> list[str]:
    names: list[str] = []
    for token in _split_text_list(raw):
        canonical = _normalize_course_name(token)
        if canonical and canonical not in names:
            names.append(canonical)
    return names


def _join_course_names(course_names: list[str]) -> str:
    return "، ".join(course_names)


def _build_missing_national_id(row: dict) -> str:
    seed = "|".join(
        [
            _clean_text(row.get("full_name")),
            _clean_text(row.get("guardian_name")),
            _clean_text(row.get("guardian_mobile")),
            _clean_text(row.get("teacher_name")),
            _clean_text(row.get("birthdate")),
        ]
    )
    return f"NOID-{hashlib.md5(seed.encode('utf-8')).hexdigest()[:10]}"


def _normalize_row(row: dict) -> dict:
    national_id = _clean_text(row.get("national_id"))
    if not national_id:
        national_id = _build_missing_national_id(row)

    previous_course_names = _parse_course_names(row.get("previous_courses"))
    desired_course_names = _parse_course_names(row.get("desired_courses"))
    course_names = desired_course_names or previous_course_names
    health_status, health_note = _normalize_health(row.get("health_status"))

    normalized = {
        "national_id": national_id,
        "full_name": _clean_text(row.get("full_name")) or "غ. م",
        "birthdate": _parse_date(row.get("birthdate")) or "1900-01-01",
        "grade": _normalize_grade(row.get("grade")) or "غ. م",
        "address": "" if _is_placeholder_text(row.get("address")) else _clean_text(row.get("address")),
        "whatsapp": _safe_phone(row.get("whatsapp")),
        "mobile": _safe_phone(row.get("mobile")),
        "guardian_name": _clean_text(row.get("guardian_name")) or "غ. م",
        "guardian_national_id": "" if _is_placeholder_text(row.get("guardian_national_id")) else _clean_text(row.get("guardian_national_id")),
        "guardian_mobile": _safe_phone(
            row.get("guardian_mobile"),
            fallback=_synthetic_phone(national_id),
        ),
        "bank_account_number": "" if _is_placeholder_text(row.get("bank_account_number")) else _clean_text(row.get("bank_account_number")),
        "bank_account_name": "" if _is_placeholder_text(row.get("bank_account_name")) else _clean_text(row.get("bank_account_name")),
        "bank_account_type": "" if _is_placeholder_text(row.get("bank_account_type")) else _clean_text(row.get("bank_account_type")),
        "previous_courses": _join_course_names(previous_course_names),
        "desired_courses": _join_course_names(desired_course_names),
        "course_names": course_names,
        "health_status": health_status,
        "health_note": health_note,
        "skills": _parse_skills(row.get("skills")),
        "teacher_name": _clean_text(row.get("teacher_name")),
        "affiliation": _normalize_affiliation(row.get("affiliation")),
    }

    if not normalized["mobile"]:
        normalized["mobile"] = ""
    if not normalized["whatsapp"]:
        normalized["whatsapp"] = ""

    return normalized


def _replace_or_keep(current, incoming, *, allow_placeholder_override: bool = True):
    if incoming is None:
        return current, False

    if isinstance(incoming, str):
        incoming = _clean_text(incoming)
        if not incoming:
            return current, False
        if incoming == "1900-01-01" or _is_placeholder_text(incoming):
            return current, False
        if isinstance(current, str) and _clean_text(current) == incoming:
            return current, False
        if current is not None and not isinstance(current, str) and str(current) == incoming:
            return current, False

    if incoming == current:
        return current, False

    if current is None:
        return incoming, True

    if isinstance(current, str):
        current_text = _clean_text(current)
        if allow_placeholder_override and (
            _is_placeholder_text(current_text) or current_text == "1900-01-01"
        ):
            return incoming, True

    return incoming, True


def _resolve_teacher(
    *,
    teacher_name: str,
    affiliation: str,
    creator: User,
    teacher_cache: dict,
) -> Teacher | None:
    if not teacher_name:
        return None

    cache_key = teacher_name.casefold()
    if cache_key in teacher_cache:
        teacher = teacher_cache[cache_key]
    else:
        teacher = Teacher.objects.select_related("user").filter(full_name__iexact=teacher_name).first()
        if not teacher:
            name_hash = hashlib.md5(teacher_name.encode("utf-8")).hexdigest()[:10]
            synthetic_national_id = f"T{name_hash}"
            phone_number = _synthetic_phone(name_hash)
            name_parts = teacher_name.split()
            try:
                teacher = teacher_create(
                    creator=creator,
                    national_id=synthetic_national_id,
                    phone_number=phone_number,
                    full_name=teacher_name,
                    first_name=name_parts[0] if name_parts else teacher_name,
                    last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "محفظ",
                    affiliation=affiliation,
                )
            except Exception:
                teacher = Teacher.objects.select_related("user").filter(full_name__iexact=teacher_name).first()

        teacher_cache[cache_key] = teacher

    if teacher and affiliation and teacher.affiliation != affiliation:
        teacher.affiliation = affiliation
        teacher.save(update_fields=["affiliation"])

    return teacher


def _resolve_course(course_name: str, course_cache: dict) -> Course | None:
    canonical_name = _normalize_course_name(course_name)
    if not canonical_name:
        return None

    cache_key = canonical_name.casefold()
    if cache_key in course_cache:
        return course_cache[cache_key]

    course = Course.objects.filter(name__iexact=canonical_name).first()
    if not course:
        course = Course.objects.create(name=canonical_name, description="")

    course_cache[cache_key] = course
    return course


def _resolve_parent(
    *,
    guardian_name: str,
    guardian_mobile: str,
    guardian_national_id: str,
    creator: User,
    parent_cache: dict,
) -> Parent | None:
    if not guardian_mobile:
        return None

    guardian_mobile = _safe_phone(guardian_mobile)
    if not guardian_mobile:
        return None

    parent_nid = _clean_text(guardian_national_id)
    if _is_placeholder_text(parent_nid):
        parent_nid = f"P{hashlib.md5(guardian_mobile.encode('utf-8')).hexdigest()[:10]}"

    cache_key = f"{parent_nid}|{guardian_mobile}"
    if cache_key in parent_cache:
        parent = parent_cache[cache_key]
    else:
        parent = Parent.objects.select_related("user").filter(user__national_id=parent_nid).first()
        if not parent:
            parent = Parent.objects.select_related("user").filter(phone_number=guardian_mobile).first()

        if not parent:
            parent_user = User.objects.filter(national_id=parent_nid).first()
            if parent_user is None:
                parent_user = User.objects.filter(phone_number=guardian_mobile, role="parent").first()
            if parent_user is None:
                name_parts = guardian_name.split() if guardian_name else []
                parent_user = user_create(
                    creator=creator,
                    national_id=parent_nid,
                    phone_number=guardian_mobile,
                    first_name=name_parts[0] if name_parts else "",
                    last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "",
                    role="parent",
                )

            parent = Parent.objects.filter(user=parent_user).first()
            if parent is None:
                parent = Parent.objects.create(
                    user=parent_user,
                    full_name=guardian_name or parent_user.get_full_name() or guardian_mobile,
                    phone_number=guardian_mobile,
                )

        parent_cache[cache_key] = parent

    changed_fields = []
    if guardian_name and parent.full_name != guardian_name:
        parent.full_name = guardian_name
        changed_fields.append("full_name")
    if guardian_mobile and parent.phone_number != guardian_mobile:
        parent.phone_number = guardian_mobile
        changed_fields.append("phone_number")
    if changed_fields:
        parent.save(update_fields=changed_fields)

    if guardian_mobile and parent.user.phone_number != guardian_mobile:
        parent.user.phone_number = guardian_mobile
        parent.user.save(update_fields=["phone_number"])

    return parent


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

                student = Student.objects.select_related("user", "teacher").filter(
                    national_id=row["national_id"]
                ).first()

                if student is None:
                    orphan = User.objects.filter(national_id=row["national_id"]).first()
                    if orphan:
                        has_profile = (
                            Student.objects.filter(user=orphan).exists()
                            or Teacher.objects.filter(user=orphan).exists()
                            or Parent.objects.filter(user=orphan).exists()
                        )
                        if not has_profile:
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
                    # Log parent error but don't fail the whole student import
                    errors.append({
                        "row": idx,
                        "national_id": row["national_id"],
                        "message": f"تنبيه: فشل ربط ولي الأمر: {str(p_exc)}"
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
                        "message": f"تنبيه: فشل تعيين المحفظ: {str(t_exc)}"
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
                        "message": f"تنبيه: فشل تحديث الدورات: {str(c_exc)}"
                    })

        except Exception as exc:
            # Extract a more user-friendly message if it's a ValidationError
            msg = str(exc)
            if hasattr(exc, 'message_dict'):
                msg = "; ".join([f"{k}: {', '.join(v)}" for k, v in exc.message_dict.items()])
            elif hasattr(exc, 'messages'):
                msg = "; ".join(exc.messages)
                
            errors.append(
                {
                    "row": idx,
                    "national_id": _clean_text(raw_row.get("national_id")) or None,
                    "message": msg,
                }
            )

    return {
        "created_count": created_count,
        "updated_count": updated_count,
        "error_count": len(errors),
        "errors": errors,
    }
