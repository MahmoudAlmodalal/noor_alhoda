from django.db.models import QuerySet

from notifications.models import Notification
from accounts.models import Parent, User
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
