import uuid
from django.db.models import QuerySet

from notifications.models import Notification
from accounts.models import Parent, ParentStudentLink, User
from students.models import Student


def notification_list(*, user: User) -> QuerySet[Notification]:
    """Return all notifications for a user, ordered by newest first."""
    return Notification.objects.filter(recipient=user).order_by("-created_at")


def notification_unread_count(*, user: User) -> int:
    """Return count of unread notifications for a user."""
    return Notification.objects.filter(recipient=user, is_read=False).count()


def announcement_recipients(
    *,
    sender: User,
    target_user_ids: list | None = None,
    target_roles: list | None = None,
) -> QuerySet[User]:
    """
    Resolve announcement recipients by explicit user ids, role filter, or
    fallback to all users except the sender.
    """
    if target_user_ids:
        return User.objects.filter(id__in=target_user_ids)
    if target_roles:
        return User.objects.filter(role__in=target_roles)
    return User.objects.all().exclude(id=sender.id)


def parents_of_student_with_phone(
    *, student: Student
) -> list[tuple[Parent, User, str]]:
    """
    (parent, parent_user, phone) tuples for a student's linked parents.
    Phone is parent.phone_number or user.phone_number (may be empty string).
    """
    links = student.parent_links.select_related("parent", "parent__user").all()
    result = []
    for link in links:
        parent = link.parent
        parent_user = parent.user
        phone = parent.phone_number or parent_user.phone_number or ""
        result.append((parent, parent_user, str(phone)))
    return result


def student_get_by_id(student_id: str | uuid.UUID) -> Student | None:
    """Return Student instance by student_id or None if not found."""
    try:
        return Student.objects.select_related("user", "teacher").get(id=student_id)
    except (Student.DoesNotExist, ValueError, TypeError):
        return None


def student_user_get_by_id(student_id: str | uuid.UUID) -> User | None:
    """Return linked User instance for a student_id or None."""
    student = student_get_by_id(student_id)
    if student and hasattr(student, "user") and student.user:
        return student.user
    return None


def parent_users_get_for_student(
    student: Student | str | uuid.UUID | None = None,
    student_id: str | uuid.UUID | None = None,
) -> list[User]:
    """
    Return linked parent User instances for a student instance or student_id.
    """
    target = student or student_id
    if not target:
        return []

    if isinstance(target, Student):
        student_obj = target
    else:
        student_obj = student_get_by_id(target)

    if not student_obj:
        return []

    links = ParentStudentLink.objects.filter(student=student_obj).select_related("parent__user")
    parent_users = []
    for link in links:
        if link.parent and link.parent.user:
            parent_users.append(link.parent.user)
    return parent_users


def teacher_can_message_student(
    teacher_user: User,
    student: Student | str | uuid.UUID | None = None,
    student_id: str | uuid.UUID | None = None,
) -> bool:
    """
    Verify if teacher_user is authorized to message the specified student.
    Returns True if teacher_user has a teacher profile and is assigned as the student's teacher.
    """
    if not hasattr(teacher_user, "teacher_profile") or not teacher_user.teacher_profile:
        return False

    target = student or student_id
    if not target:
        return False

    if isinstance(target, Student):
        student_obj = target
    else:
        student_obj = student_get_by_id(target)

    if not student_obj or not student_obj.teacher_id:
        return False

    return student_obj.teacher_id == teacher_user.teacher_profile.id

