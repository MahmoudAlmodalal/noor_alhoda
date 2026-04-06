from django.db.models import QuerySet

from backend.notifications.models import Notification
from backend.accounts.models import User


def notification_list(*, user: User) -> QuerySet[Notification]:
    """Return all notifications for a user, ordered by newest first."""
    return Notification.objects.filter(recipient=user).order_by("-created_at")


def notification_unread_count(*, user: User) -> int:
    """Return count of unread notifications for a user."""
    return Notification.objects.filter(recipient=user, is_read=False).count()
