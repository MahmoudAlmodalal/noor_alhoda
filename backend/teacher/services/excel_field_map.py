"""
Field map shared by the teacher xlsx export and import.

Defines the column order, Arabic header → internal field map, and the
Arabic ↔ enum helpers for the three teacher-form fields not already
covered by ``excel_import.normalization`` (affiliation, session_days,
courses), plus the reverse helpers used when *rendering* an export.

Keeping export and import on one spec means an admin can round-trip a
file without column drift.
"""
from teacher.models import Teacher
from students.services.excel_import.normalization import (
    _clean_text,
    _normalize_arabic_key,
)


# ---------------------------------------------------------------------------
# Header order (used for export, template, and import)
# ---------------------------------------------------------------------------
HEADERS: list[str] = [
    "الاسم الرباعي",
    "رقم الهوية",
    "رقم الجوال",
    "تاريخ الميلاد",
    "الحالة الاجتماعية",
    "المؤهل العلمي",
    "التخصص",
    "آخر دورة تجويد",
    "المسمى الوظيفي",
    "التباعية",
    "اسم الحلقة",
    "أيام الحلقة",
    "أقصى عدد طلاب",
    "الدورات",
    "عدد أفراد الأسرة",
    "اسم المحفظة",
    "رقم المحفظة",
    "تاريخ الإنشاء",
    "آخر تحديث",
]


HEADER_TO_FIELD: dict[str, str] = {
    "الاسم الرباعي": "full_name",
    "رقم الهوية": "national_id",
    "رقم الجوال": "phone_number",
    "تاريخ الميلاد": "birthdate",
    "الحالة الاجتماعية": "marital_status",
    "المؤهل العلمي": "education_qualification",
    "التخصص": "specialization",
    "آخر دورة تجويد": "last_tajweed_course",
    "المسمى الوظيفي": "job_title",
    "التباعية": "affiliation",
    "اسم الحلقة": "ring_name",
    "أيام الحلقة": "session_days",
    "أقصى عدد طلاب": "max_students",
    "الدورات": "course_names",
    "عدد أفراد الأسرة": "family_members_count",
    "اسم المحفظة": "wallet_name",
    "رقم المحفظة": "wallet_number",
    # created_at / updated_at are export-only; if present in an upload the
    # parser drops them.
}


# Lookup with Arabic-key normalisation applied — built once at import time
# so the import view can resolve headers regardless of NBSP / RLM / LRM.
NORMALIZED_HEADER_TO_FIELD: dict[str, str] = {
    _normalize_arabic_key(header): field
    for header, field in HEADER_TO_FIELD.items()
}


# ---------------------------------------------------------------------------
# Affiliation
# ---------------------------------------------------------------------------
_AFFILIATION_ALIASES: dict[str, str] = {
    "دار القرآن": Teacher.Affiliation.DAR_QURAN,
    "دار قرآن": Teacher.Affiliation.DAR_QURAN,
    "أوقاف": Teacher.Affiliation.AWQAF,
    "اوقاف": Teacher.Affiliation.AWQAF,
    "الأوقاف": Teacher.Affiliation.AWQAF,
    "شيخ التباعية": Teacher.Affiliation.SHEIKH_TABAEA,
    "شيخ تباعية": Teacher.Affiliation.SHEIKH_TABAEA,
}

_AFFILIATION_ARABIC: dict[str, str] = {
    Teacher.Affiliation.DAR_QURAN: "دار القرآن",
    Teacher.Affiliation.AWQAF: "أوقاف",
    Teacher.Affiliation.SHEIKH_TABAEA: "شيخ التباعية",
}


def _normalize_affiliation(value) -> str:
    text = _clean_text(value)
    if not text:
        return ""
    normalized = _normalize_arabic_key(text)
    for alias, code in _AFFILIATION_ALIASES.items():
        if normalized == _normalize_arabic_key(alias):
            return code
    if text in Teacher.Affiliation.values:
        return text
    return ""


def affiliation_to_arabic(code: str) -> str:
    return _AFFILIATION_ARABIC.get(code or "", "")


# ---------------------------------------------------------------------------
# Session days
# ---------------------------------------------------------------------------
_DAY_ALIASES: dict[str, str] = {
    "السبت": "sat", "سبت": "sat", "sat": "sat", "saturday": "sat",
    "الأحد": "sun", "الاحد": "sun", "احد": "sun", "sun": "sun", "sunday": "sun",
    "الاثنين": "mon", "الإثنين": "mon", "اثنين": "mon", "mon": "mon", "monday": "mon",
    "الثلاثاء": "tue", "ثلاثاء": "tue", "tue": "tue", "tuesday": "tue",
    "الأربعاء": "wed", "الاربعاء": "wed", "اربعاء": "wed", "wed": "wed", "wednesday": "wed",
    "الخميس": "thu", "خميس": "thu", "thu": "thu", "thursday": "thu",
    "الجمعة": "fri", "جمعة": "fri", "fri": "fri", "friday": "fri",
}

_DAY_ARABIC: dict[str, str] = {
    "sat": "السبت",
    "sun": "الأحد",
    "mon": "الاثنين",
    "tue": "الثلاثاء",
    "wed": "الأربعاء",
    "thu": "الخميس",
    "fri": "الجمعة",
}

_DAY_ORDER = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"]


def _normalize_session_days(value) -> list[str]:
    if isinstance(value, list):
        tokens = [str(item) for item in value]
    else:
        text = _clean_text(value)
        if not text:
            return []
        tokens = [
            tok for raw in text.replace("\n", "،").replace(",", "،").split("،")
            if (tok := raw.strip())
        ]

    seen: set[str] = set()
    result: list[str] = []
    for tok in tokens:
        normalized = _normalize_arabic_key(tok).lower()
        for alias, code in _DAY_ALIASES.items():
            if normalized == _normalize_arabic_key(alias).lower():
                if code not in seen:
                    seen.add(code)
                    result.append(code)
                break
    # Keep canonical order so re-exported files stay stable.
    return [d for d in _DAY_ORDER if d in seen]


def session_days_to_arabic(days) -> str:
    if not days:
        return ""
    ordered = [d for d in _DAY_ORDER if d in set(days)]
    return "، ".join(_DAY_ARABIC[d] for d in ordered)


# ---------------------------------------------------------------------------
# Courses (M2M by name)
# ---------------------------------------------------------------------------
def _normalize_course_names(value) -> list[str]:
    if isinstance(value, list):
        return [n for n in (_clean_text(item) for item in value) if n]
    text = _clean_text(value)
    if not text:
        return []
    parts = text.replace("\n", "،").replace(",", "،").split("،")
    return [p for p in (s.strip() for s in parts) if p]


# ---------------------------------------------------------------------------
# Marital status & job_title — Arabic rendering for export
# ---------------------------------------------------------------------------
_MARITAL_ARABIC: dict[str, str] = {
    Teacher.MaritalStatus.SINGLE: "أعزب",
    Teacher.MaritalStatus.MARRIED: "متزوج",
}


def marital_to_arabic(code: str) -> str:
    return _MARITAL_ARABIC.get(code or "", "")


_JOB_TITLE_ARABIC: dict[str, str] = {
    Teacher.JobTitle.TEACHER: "محفظ",
    Teacher.JobTitle.TEACHER_RECEPTION: "محفظ استقبال",
    Teacher.JobTitle.TEACHER_YEAR_CIRCLE: "محفظ حلقة سنة",
    Teacher.JobTitle.TEACHER_FORUM_CIRCLE: "محفظ حلقة منتدى",
    Teacher.JobTitle.TEACHER_ASSISTANT: "مساعد محفظ",
    Teacher.JobTitle.COURSE_INSTRUCTOR: "معلم دورات",
    Teacher.JobTitle.ADMIN_TEACHER: "مساعد إداري + محفظ",
}


def job_title_to_arabic(code: str) -> str:
    return _JOB_TITLE_ARABIC.get(code or "", "")
