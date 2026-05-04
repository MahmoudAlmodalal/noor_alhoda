"""
Teacher-only xlsx bulk import.

Distinct from ``staff_excel_bulk_import`` (which routes by job title and
also creates ``StaffMember`` records): this orchestrator is reachable
only from the teachers page and rejects non-teaching titles per row
rather than silently creating a staff record.

Applies every field on the teacher form: identity (full_name, national_id,
phone), HR fields (birthdate, marital_status, education_qualification,
last_tajweed_course, family_members_count, wallet_name, wallet_number,
job_title) — plus the six teacher-form fields the staff importer ignores
(specialization, affiliation, ring_name, session_days, max_students,
courses M2M).

Upsert by ``user.national_id``; per-row try/except so one bad row does
not abort the whole import.
"""
from django.db import transaction
from rest_framework.exceptions import PermissionDenied

from accounts.models import User
from core.permissions import is_admin_user
from courses.models import Course
from teacher.models import Teacher
from teacher.services.excel_import.normalization import (
    _clean_national_id,
    _format_exception_message,
    _normalize_row,
    is_non_teaching_title,
    is_teaching_title,
)
from teacher.services.excel_import.orchestrator import (
    _apply_field,
    _apply_teacher_profile_fields,
)
from teacher.services.teacher_services import teacher_create


_TEACHER_FORM_FIELDS = (
    "specialization",
    "affiliation",
    "ring_name",
    "session_days",
    "max_students",
)


def _apply_teacher_form_fields(teacher: Teacher, normalized: dict) -> list[str]:
    changed: list[str] = []
    for field in _TEACHER_FORM_FIELDS:
        incoming = normalized.get(field)
        # `_apply_field` treats only ``""`` and ``None`` as "no change". Map the
        # other empty shapes the field map can return — an empty list for
        # ``session_days`` — to None so a blank cell preserves existing data
        # instead of clearing the teacher's days.
        if isinstance(incoming, list) and not incoming:
            incoming = None
        if _apply_field(teacher, field, incoming):
            changed.append(field)
    return changed


def _apply_courses(teacher: Teacher, normalized: dict) -> None:
    """Resolve course names → existing Course rows and replace M2M.

    Blank cell ⇒ leave existing assignments untouched (matches the
    "empty means no change" semantics used elsewhere in the importer).
    Names that don't match any Course are silently skipped — the rest
    of the import is tolerant the same way.
    """
    names = normalized.get("course_names") or []
    if not names:
        return
    course_qs = list(Course.objects.filter(name__in=names))
    teacher.courses.set(course_qs)


def _create_teacher_record(*, creator: User, normalized: dict) -> Teacher:
    name_parts = (normalized["full_name"] or "").split()
    teacher = teacher_create(
        creator=creator,
        national_id=normalized["national_id"],
        phone_number=normalized["phone_number"],
        full_name=normalized["full_name"],
        first_name=name_parts[0] if name_parts else normalized["full_name"],
        last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "محفظ",
        specialization=normalized.get("specialization") or "",
        session_days=normalized.get("session_days") or [],
        max_students=normalized.get("max_students") or 25,
        affiliation=normalized.get("affiliation") or "",
        ring_name=normalized.get("ring_name") or "",
    )
    changed = _apply_teacher_profile_fields(teacher, normalized)
    if changed:
        teacher.save(update_fields=changed + ["updated_at"])
    _apply_courses(teacher, normalized)
    return teacher


def _update_existing_teacher(*, teacher: Teacher, normalized: dict) -> Teacher:
    user = teacher.user

    incoming_phone = normalized.get("phone_number") or ""
    if incoming_phone and user.phone_number != incoming_phone:
        user.phone_number = incoming_phone
        user.save(update_fields=["phone_number"])

    changed: list[str] = []
    if normalized.get("full_name") and teacher.full_name != normalized["full_name"]:
        teacher.full_name = normalized["full_name"]
        changed.append("full_name")

    changed += _apply_teacher_profile_fields(teacher, normalized)
    changed += _apply_teacher_form_fields(teacher, normalized)

    if changed:
        teacher.save(update_fields=changed + ["updated_at"])

    _apply_courses(teacher, normalized)
    return teacher


@transaction.atomic
def teacher_excel_bulk_import(*, creator: User, rows: list) -> dict:
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه استيراد المحفظين.")

    created_count = 0
    updated_count = 0
    errors: list[dict] = []

    for idx, raw_row in enumerate(rows, start=1):
        try:
            with transaction.atomic():
                # Reject blank/non-digit national IDs *before* normalization —
                # `_normalize_row` (shared with the staff importer) silently
                # falls back to a synthetic 99-prefixed id for staff who lack
                # an ID, which is wrong for teachers since national_id is the
                # USERNAME_FIELD they log in with.
                if not _clean_national_id(raw_row.get("national_id")):
                    raise ValueError("رقم الهوية مطلوب وأرقاماً فقط.")

                row = _normalize_row(raw_row)

                if not row["full_name"]:
                    raise ValueError("اسم المحفظ مطلوب.")

                job_title = row["job_title"]
                if job_title and is_non_teaching_title(job_title):
                    raise ValueError(
                        "لا يقبل هذا الاستيراد المسميات غير التدريسية."
                    )
                if job_title and not is_teaching_title(job_title):
                    raise ValueError(f"مسمى وظيفي غير مدعوم: {job_title}")

                # Default to TEACHER when the cell is blank — the staff
                # importer requires an explicit job title because it has
                # to choose between Teacher / StaffMember; here we know
                # the answer.
                if not job_title:
                    row["job_title"] = Teacher.JobTitle.TEACHER

                existing_teacher = (
                    Teacher.objects.select_related("user")
                    .filter(user__national_id=row["national_id"])
                    .first()
                )

                if existing_teacher is None:
                    existing_user = User.objects.filter(
                        national_id=row["national_id"]
                    ).first()
                    if existing_user is not None and not (
                        hasattr(existing_user, "student_profile")
                        and existing_user.student_profile is not None
                    ):
                        existing_user.delete()

                if existing_teacher is None:
                    _create_teacher_record(creator=creator, normalized=row)
                    created_count += 1
                else:
                    _update_existing_teacher(teacher=existing_teacher, normalized=row)
                    updated_count += 1

        except Exception as exc:
            errors.append(
                {
                    "row": idx,
                    "national_id": str(raw_row.get("national_id") or "") or None,
                    "message": _format_exception_message(exc),
                }
            )

    return {
        "created_count": created_count,
        "updated_count": updated_count,
        "error_count": len(errors),
        "errors": errors,
    }
