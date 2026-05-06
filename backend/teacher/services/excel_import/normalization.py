"""
Pure data-cleaning helpers for the staff Excel import pipeline. No ORM, no
mutations — only string normalisation, marital/job-title parsing, and row
shaping. Most generic helpers (`_clean_text`, `_safe_phone`, `_parse_date`,
`_is_placeholder_text`, `_normalize_arabic_key`) are re-imported from the
student importer to avoid duplication.
"""
import hashlib
import re

from accounts.models import StaffMember
from students.services.excel_import.normalization import (
    _clean_text,
    _is_placeholder_text,
    _normalize_arabic_key,
    _parse_date,
    _safe_phone,
)
from teacher.models import Teacher


_MARITAL_ALIASES = {
    "متزوج": "married",
    "متزوجه": "married",
    "متزوجة": "married",
    "married": "married",
    "أعزب": "single",
    "اعزب": "single",
    "عزباء": "single",
    "single": "single",
}


_JOB_TITLE_MAP: dict[str, str] = {
    # StaffMember (non-teaching)
    "مدير المركز": StaffMember.JobTitle.DIRECTOR,
    "مدير": StaffMember.JobTitle.DIRECTOR,
    "نائب المدير": StaffMember.JobTitle.DEPUTY_DIRECTOR,
    "نائب مدير المركز": StaffMember.JobTitle.DEPUTY_DIRECTOR,
    "الإداري": StaffMember.JobTitle.ADMIN,
    "إداري": StaffMember.JobTitle.ADMIN,
    "اداري": StaffMember.JobTitle.ADMIN,
    "إعلامي": StaffMember.JobTitle.MEDIA,
    "اعلامي": StaffMember.JobTitle.MEDIA,
    "اعلام": StaffMember.JobTitle.MEDIA,

    # Teacher (teaching)
    "محفظ": Teacher.JobTitle.TEACHER,
    "محفظة": Teacher.JobTitle.TEACHER,
    "محفظ استقبال": Teacher.JobTitle.TEACHER_RECEPTION,
    "محفظ حلقة سنة": Teacher.JobTitle.TEACHER_YEAR_CIRCLE,
    "محفظ حلقة سنه": Teacher.JobTitle.TEACHER_YEAR_CIRCLE,
    "محفظ حلقة منتدى": Teacher.JobTitle.TEACHER_FORUM_CIRCLE,
    "محفظ المنتدى": Teacher.JobTitle.TEACHER_FORUM_CIRCLE,
    "مساعد محفظ": Teacher.JobTitle.TEACHER_ASSISTANT,
    "معلم دورات": Teacher.JobTitle.COURSE_INSTRUCTOR,
    "معلم": Teacher.JobTitle.COURSE_INSTRUCTOR,
    "مساعد إداري + محفظ": Teacher.JobTitle.ADMIN_TEACHER,
    "مساعد اداري + محفظ": Teacher.JobTitle.ADMIN_TEACHER,
    "مساعد اداري ومحفظ": Teacher.JobTitle.ADMIN_TEACHER,
    "مساعد إداري ومحفظ": Teacher.JobTitle.ADMIN_TEACHER,
}


_NON_TEACHING_TITLES = set(StaffMember.JobTitle.values)
_TEACHING_TITLES = set(Teacher.JobTitle.values)


def _clean_national_id(value) -> str:
    """Strip whitespace, NBSP and bidi marks. Return only digits."""
    if value is None:
        return ""
    raw = str(value).strip()
    if not raw:
        return ""
    cleaned = raw.replace(" ", "").replace("‎", "").replace("‏", "")
    digits = "".join(ch for ch in cleaned if ch.isdigit())
    return digits


def _normalize_marital_status(value) -> str:
    text = _clean_text(value)
    if not text:
        return ""
    normalized = _normalize_arabic_key(text)
    for alias, code in _MARITAL_ALIASES.items():
        if normalized == _normalize_arabic_key(alias):
            return code
    return ""


def _normalize_job_title(value) -> str:
    """Map an Arabic job title to either a Teacher or StaffMember enum value.
    Returns "" when the title is unknown — caller decides what to do."""
    text = _clean_text(value)
    if not text:
        return ""
    normalized = _normalize_arabic_key(text)
    for alias, code in _JOB_TITLE_MAP.items():
        if normalized == _normalize_arabic_key(alias):
            return code
    if "محفظ" in text and "مساعد" in text:
        return Teacher.JobTitle.TEACHER_ASSISTANT
    if "محفظ" in text:
        return Teacher.JobTitle.TEACHER
    if "إعلام" in text or "اعلام" in text:
        return StaffMember.JobTitle.MEDIA
    if "إدار" in text or "ادار" in text:
        return StaffMember.JobTitle.ADMIN
    return ""


def is_teaching_title(job_title: str) -> bool:
    return job_title in _TEACHING_TITLES


def is_non_teaching_title(job_title: str) -> bool:
    return job_title in _NON_TEACHING_TITLES


def _synthetic_staff_national_id(name: str) -> str:
    """Build a 12-digit synthetic id starting with 99.
    Real Palestinian IDs do not start with 99, so collisions are practically
    impossible while the id remains valid for the digit-only national_id regex.
    """
    seed = (name or "").encode("utf-8")
    digest = int(hashlib.md5(seed).hexdigest(), 16)
    return f"99{digest % 10**10:010d}"


def _coerce_int(value) -> int | None:
    if value is None:
        return None
    text = _clean_text(value)
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def _normalize_row(row: dict) -> dict:
    # Imported lazily to keep this module ORM-light and avoid a circular
    # import (excel_field_map → teacher.models, which is also pulled
    # in by this module).
    from teacher.services.excel_field_map import (
        _normalize_affiliation,
        _normalize_course_names,
        _normalize_session_days,
    )

    full_name = _clean_text(row.get("full_name"))
    job_title = _normalize_job_title(row.get("job_title"))
    national_id = _clean_national_id(row.get("national_id"))
    if not national_id:
        national_id = _synthetic_staff_national_id(full_name or job_title or "staff")

    max_students = _coerce_int(row.get("max_students"))

    return {
        "full_name": full_name,
        "national_id": national_id,
        "phone_number": _safe_phone(row.get("phone_number")),
        "birthdate": _parse_date(row.get("birthdate")) or "",
        "marital_status": _normalize_marital_status(row.get("marital_status")),
        "education_qualification": (
            "" if _is_placeholder_text(row.get("education_qualification"))
            else _clean_text(row.get("education_qualification"))
        ),
        "last_tajweed_course": (
            "" if _is_placeholder_text(row.get("last_tajweed_course"))
            else _clean_text(row.get("last_tajweed_course"))
        ),
        "family_members_count": _coerce_int(row.get("family_members_count")),
        "wallet_name": (
            "" if _is_placeholder_text(row.get("wallet_name"))
            else _clean_text(row.get("wallet_name"))
        ),
        "wallet_number": _clean_national_id(row.get("wallet_number"))
            or ("" if _is_placeholder_text(row.get("wallet_number"))
                else _clean_text(row.get("wallet_number"))),
        "job_title": job_title,
        # Teacher-form fields (ignored by the staff orchestrator, used by
        # the teacher orchestrator).
        "specialization": (
            "" if _is_placeholder_text(row.get("specialization"))
            else _clean_text(row.get("specialization"))
        ),
        "affiliation": _normalize_affiliation(row.get("affiliation")),
        "ring_name": (
            "" if _is_placeholder_text(row.get("ring_name"))
            else _clean_text(row.get("ring_name"))
        ),
        "session_days": _normalize_session_days(row.get("session_days")),
        "max_students": max_students,
        "course_names": _normalize_course_names(row.get("course_names")),
    }


def _format_exception_message(exc: Exception) -> str:
    detail = getattr(exc, "detail", None)
    if detail is not None:
        if isinstance(detail, dict):
            parts = []
            for key, value in detail.items():
                if isinstance(value, (list, tuple)):
                    parts.append(f"{key}: {', '.join(str(v) for v in value)}")
                else:
                    parts.append(f"{key}: {value}")
            return "؛ ".join(parts)
        return str(detail)

    message_dict = getattr(exc, "message_dict", None)
    if message_dict:
        return "؛ ".join(
            f"{field}: {', '.join(str(item) for item in messages)}"
            for field, messages in message_dict.items()
        )

    messages = getattr(exc, "messages", None)
    if messages:
        return "؛ ".join(str(item) for item in messages)

    return str(exc) or exc.__class__.__name__
