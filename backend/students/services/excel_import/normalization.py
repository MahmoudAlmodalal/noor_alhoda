"""
Pure data-cleaning helpers for the Excel import pipeline. No ORM, no
mutations — only string normalisation, phone/date parsing, and row
shaping. Safe to import from selectors, services, or tests.
"""
import hashlib
import re

from accounts.utils import normalize_phone


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


def _flatten_detail(detail) -> list[str]:
    if detail is None:
        return []
    if isinstance(detail, dict):
        parts: list[str] = []
        for key, value in detail.items():
            nested = _flatten_detail(value)
            if not nested:
                continue
            if key in (None, "non_field_errors"):
                parts.extend(nested)
            else:
                parts.append(f"{key}: {', '.join(nested)}")
        return parts
    if isinstance(detail, (list, tuple)):
        parts = []
        for item in detail:
            parts.extend(_flatten_detail(item))
        return parts
    return [str(detail)]


def _format_exception_message(exc: Exception) -> str:
    detail = getattr(exc, "detail", None)
    if detail is not None:
        parts = _flatten_detail(detail)
        if parts:
            return "؛ ".join(parts)

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
    digest = int(hashlib.md5(seed.encode("utf-8")).hexdigest(), 16)
    return f"97{digest % 10**10:010d}"


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
