"""
Top-level Excel import orchestrator for staff (هيكلية المركز).

Each row is classified by its Arabic job title:

- Teaching titles (محفظ, محفظ استقبال, مساعد محفظ, ...) → `Teacher` (with a
  matching `User` whose role="teacher" — the existing `teacher_create` service
  enforces digit-only national_id).

- Non-teaching titles (مدير المركز, نائب المدير, الإداري, إعلامي) →
  `StaffMember`. No User account is created — these are HR records only.
  An admin can wire a `User` later by setting `staff_member.user`.
"""
from django.db import transaction
from rest_framework.exceptions import PermissionDenied

from accounts.models import StaffMember, User
from core.permissions import is_admin_user
from teacher.models import Teacher
from teacher.services.excel_import.normalization import (
    _format_exception_message,
    _normalize_row,
    is_non_teaching_title,
    is_teaching_title,
)
from teacher.services.teacher_services import teacher_create


_TEACHER_PROFILE_FIELDS = (
    "birthdate",
    "marital_status",
    "education_qualification",
    "last_tajweed_course",
    "family_members_count",
    "wallet_name",
    "wallet_number",
    "job_title",
)

_STAFF_FIELDS = (
    "full_name",
    "phone_number",
    "birthdate",
    "marital_status",
    "education_qualification",
    "last_tajweed_course",
    "family_members_count",
    "wallet_name",
    "wallet_number",
    "job_title",
)


def _apply_field(target, attr: str, incoming) -> bool:
    """
    Set `attr` on `target` only when `incoming` is meaningful and different.
    Empty strings / None for charfield-with-default are treated as "no change"
    so re-imports do not overwrite richer existing data.
    """
    if incoming in (None, ""):
        return False
    current = getattr(target, attr, None)
    if current == incoming:
        return False
    setattr(target, attr, incoming)
    return True


def _apply_teacher_profile_fields(teacher: Teacher, normalized: dict) -> list[str]:
    changed: list[str] = []
    for field in _TEACHER_PROFILE_FIELDS:
        if _apply_field(teacher, field, normalized.get(field)):
            changed.append(field)
    return changed


def _apply_staff_fields(staff: StaffMember, normalized: dict) -> list[str]:
    changed: list[str] = []
    for field in _STAFF_FIELDS:
        if _apply_field(staff, field, normalized.get(field)):
            changed.append(field)
    return changed


def _create_teacher_record(*, creator: User, normalized: dict) -> Teacher:
    name_parts = (normalized["full_name"] or "").split()
    teacher = teacher_create(
        creator=creator,
        national_id=normalized["national_id"],
        phone_number=normalized["phone_number"],
        full_name=normalized["full_name"],
        first_name=name_parts[0] if name_parts else normalized["full_name"],
        last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "محفظ",
    )
    changed = _apply_teacher_profile_fields(teacher, normalized)
    if changed:
        teacher.save(update_fields=changed + ["updated_at"])
    return teacher


def _update_existing_teacher(*, teacher: Teacher, normalized: dict) -> Teacher:
    user = teacher.user
    user_changed: list[str] = []

    incoming_phone = normalized.get("phone_number") or ""
    if incoming_phone and user.phone_number != incoming_phone:
        user.phone_number = incoming_phone
        user_changed.append("phone_number")

    if user_changed:
        user.save(update_fields=user_changed)

    if normalized.get("full_name") and teacher.full_name != normalized["full_name"]:
        teacher.full_name = normalized["full_name"]
        changed = _apply_teacher_profile_fields(teacher, normalized) + ["full_name"]
    else:
        changed = _apply_teacher_profile_fields(teacher, normalized)

    if changed:
        teacher.save(update_fields=changed + ["updated_at"])

    return teacher


def _upsert_staff_member(*, normalized: dict) -> tuple[StaffMember, bool]:
    """Returns (staff_member, was_created)."""
    staff = StaffMember.objects.filter(national_id=normalized["national_id"]).first()
    if staff is None:
        staff = StaffMember.objects.create(
            full_name=normalized["full_name"] or normalized["national_id"],
            national_id=normalized["national_id"],
            phone_number=normalized.get("phone_number") or "",
            birthdate=normalized.get("birthdate") or None,
            marital_status=normalized.get("marital_status") or "",
            education_qualification=normalized.get("education_qualification") or "",
            last_tajweed_course=normalized.get("last_tajweed_course") or "",
            family_members_count=normalized.get("family_members_count"),
            wallet_name=normalized.get("wallet_name") or "",
            wallet_number=normalized.get("wallet_number") or "",
            job_title=normalized["job_title"],
        )
        return staff, True

    changed = _apply_staff_fields(staff, normalized)
    if changed:
        staff.save(update_fields=changed + ["updated_at"])
    return staff, False


@transaction.atomic
def staff_excel_bulk_import(*, creator: User, rows: list) -> dict:
    if not is_admin_user(creator):
        raise PermissionDenied("فقط المدير يمكنه استيراد الهيكلية.")

    created_count = 0
    updated_count = 0
    errors: list[dict] = []

    for idx, raw_row in enumerate(rows, start=1):
        try:
            with transaction.atomic():
                row = _normalize_row(raw_row)

                if not row["full_name"]:
                    raise ValueError("اسم الموظف مطلوب.")

                job_title = row["job_title"]
                if not job_title:
                    raise ValueError("المسمى الوظيفي غير معروف.")

                if is_non_teaching_title(job_title):
                    _, created = _upsert_staff_member(normalized=row)
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                    continue

                if not is_teaching_title(job_title):
                    raise ValueError(f"مسمى وظيفي غير مدعوم: {job_title}")

                existing_teacher = (
                    Teacher.objects.select_related("user")
                    .filter(user__national_id=row["national_id"])
                    .first()
                )
                if existing_teacher is None:
                    existing_user = User.objects.filter(
                        national_id=row["national_id"]
                    ).first()
                    if existing_user is not None:
                        # Promote orphan user → teacher record. Avoid the
                        # unique-constraint clash by deleting the user only
                        # when it has no other profile attached.
                        if not (
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
