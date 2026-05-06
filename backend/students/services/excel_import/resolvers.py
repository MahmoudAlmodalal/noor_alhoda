"""
Cache-driven lookup-or-create resolvers for the Excel import pipeline.
Pure reads ("find by X") go through selectors in
`students.selectors.import_selectors`. Writes (create teacher/parent/course,
reconcile phone drift) stay here, inside the orchestrator's transaction.
"""
import hashlib

from accounts.models import Parent, User
from accounts.services.user_services import user_create
from courses.models import Course
from teacher.models import Teacher
from teacher.services.teacher_services import teacher_create

from students.selectors.import_selectors import (
    course_find_by_name,
    parent_find_by_nid,
    parent_find_by_phone,
    parent_find_by_user,
    teacher_find_by_first_last_name,
    teacher_find_by_loose_name,
    teacher_find_by_name,
    user_find_by_national_id,
    user_find_parent_by_phone,
)

from students.services.excel_import.normalization import (
    _clean_text,
    _is_placeholder_text,
    _normalize_course_name,
    _safe_phone,
    _synthetic_phone,
)


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
        teacher = teacher_find_by_name(name=teacher_name)
        if not teacher:
            teacher = teacher_find_by_loose_name(name=teacher_name)
        if not teacher:
            # Try matching by first and last name
            name_parts = teacher_name.split()
            if len(name_parts) >= 2:
                first_name = name_parts[0]
                last_name = " ".join(name_parts[1:])
                teacher = teacher_find_by_first_last_name(
                    first_name=first_name,
                    last_name=last_name,
                )
        if not teacher:
            name_hash = hashlib.md5(teacher_name.encode("utf-8")).hexdigest()
            synthetic_national_id = f"99{int(name_hash, 16) % 10**10:010d}"
            phone_number = _synthetic_phone(name_hash[:10])
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
                teacher = teacher_find_by_name(name=teacher_name)

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

    course = course_find_by_name(name=canonical_name)
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
        digest = int(hashlib.md5(guardian_mobile.encode("utf-8")).hexdigest(), 16)
        parent_nid = f"98{digest % 10**10:010d}"

    cache_key = f"{parent_nid}|{guardian_mobile}"
    if cache_key in parent_cache:
        parent = parent_cache[cache_key]
    else:
        parent = parent_find_by_nid(national_id=parent_nid)
        if not parent:
            parent = parent_find_by_phone(phone=guardian_mobile)

        if not parent:
            parent_user = user_find_by_national_id(national_id=parent_nid)
            if parent_user is None:
                parent_user = user_find_parent_by_phone(phone=guardian_mobile)
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

            parent = parent_find_by_user(user=parent_user)
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
