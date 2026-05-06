"""
Read-only lookups consumed by the Excel import pipeline.
Centralised here so the import resolvers / orchestrator do not issue raw
ORM queries — per the selector/service split documented in backend/CLAUDE.md.
"""
from accounts.models import Parent, User
from courses.models import Course
from students.models import Student
from teacher.models import Teacher


def teacher_find_by_name(*, name: str) -> Teacher | None:
    return (
        Teacher.objects.select_related("user")
        .filter(full_name__iexact=name)
        .first()
    )


def teacher_find_by_loose_name(*, name: str) -> Teacher | None:
    """
    Match a short Arabic name (e.g. "محمد النحال") against full quadrinominal
    teacher names (e.g. "محمد يونس محمد النحال") by first-token + last-token
    overlap. Returns the candidate only when exactly one Teacher matches.

    Single-token names skip the match (returns None) — they're too ambiguous
    in this domain (many "محمد"s).
    """
    cleaned = (name or "").strip()
    short_tokens = cleaned.split()
    if len(short_tokens) < 2:
        return None

    short_first = short_tokens[0]
    short_last = short_tokens[-1]

    matches = []
    for teacher in Teacher.objects.select_related("user").only(
        "id", "full_name", "user__national_id", "user__first_name", "user__last_name"
    ):
        candidate_tokens = (teacher.full_name or "").strip().split()
        if not candidate_tokens:
            continue
        if candidate_tokens[0] == short_first and candidate_tokens[-1] == short_last:
            matches.append(teacher)
            if len(matches) > 1:
                return None

    return matches[0] if len(matches) == 1 else None


def teacher_find_by_first_last_name(*, first_name: str, last_name: str) -> Teacher | None:
    """
    Match a teacher by first_name and last_name from the User profile.
    Useful when the imported name has a different structure than the stored full_name.

    Example:
    - imported: "احمد علي" (first: احمد, last: علي)
    - stored: "احمد محمود علي" (first: احمد, last: محمود علي)

    Returns the candidate only when exactly one Teacher matches.
    """
    if not first_name or not last_name:
        return None

    first_name = (first_name or "").strip()
    last_name = (last_name or "").strip()

    if not first_name or not last_name:
        return None

    matches = []
    for teacher in Teacher.objects.select_related("user").only(
        "id", "full_name", "user__first_name", "user__last_name"
    ):
        user = teacher.user
        if (user.first_name and user.first_name.strip() == first_name and
            user.last_name and user.last_name.strip() == last_name):
            matches.append(teacher)
            if len(matches) > 1:
                return None

    return matches[0] if len(matches) == 1 else None


def course_find_by_name(*, name: str) -> Course | None:
    return Course.objects.filter(name__iexact=name).first()


def parent_find_by_nid(*, national_id: str) -> Parent | None:
    return (
        Parent.objects.select_related("user")
        .filter(user__national_id=national_id)
        .first()
    )


def parent_find_by_phone(*, phone: str) -> Parent | None:
    return (
        Parent.objects.select_related("user")
        .filter(phone_number=phone)
        .first()
    )


def parent_find_by_user(*, user: User) -> Parent | None:
    return Parent.objects.filter(user=user).first()


def user_find_by_national_id(*, national_id: str) -> User | None:
    return User.objects.filter(national_id=national_id).first()


def user_find_parent_by_phone(*, phone: str) -> User | None:
    return User.objects.filter(phone_number=phone, role="parent").first()


def student_find_by_national_id(*, national_id: str) -> Student | None:
    return (
        Student.objects.select_related("user", "teacher")
        .filter(user__national_id=national_id)
        .first()
    )


def student_exists_for_user(*, user: User) -> bool:
    return Student.objects.filter(user=user).exists()


def teacher_exists_for_user(*, user: User) -> bool:
    return Teacher.objects.filter(user=user).exists()
