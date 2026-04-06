from urllib.parse import quote

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from backend.notifications.models import Notification
from backend.accounts.models import User


@transaction.atomic
def announcement_send(*, sender: User, title: str, body: str, target_roles: list = None, target_user_ids: list = None) -> int:
    """
    FR-25: Director sends announcement to all users or specific groups.
    Returns count of notifications created.
    """
    if sender.role != "admin":
        raise PermissionDenied("فقط المدير يمكنه إرسال الإعلانات.")

    if target_user_ids:
        recipients = User.objects.filter(id__in=target_user_ids, is_active=True)
    elif target_roles:
        recipients = User.objects.filter(role__in=target_roles, is_active=True)
    else:
        recipients = User.objects.filter(is_active=True).exclude(id=sender.id)

    notifications = [
        Notification(recipient=user, type="announcement", title=title, body=body)
        for user in recipients
    ]
    Notification.objects.bulk_create(notifications)
    return len(notifications)


@transaction.atomic
def notification_create(*, recipient: User, type: str, title: str, body: str) -> Notification:
    """Create an in-app notification."""
    notification = Notification(
        recipient=recipient,
        type=type,
        title=title,
        body=body,
    )
    notification.full_clean()
    notification.save()
    return notification


@transaction.atomic
def notification_mark_read(*, notification_id, user: User) -> Notification:
    """Mark a single notification as read."""
    notification = get_object_or_404(Notification, id=notification_id, recipient=user)
    notification.is_read = True
    notification.save()
    return notification


@transaction.atomic
def notification_mark_all_read(*, user: User) -> int:
    """Mark all notifications as read for a user. Returns count updated."""
    return Notification.objects.filter(recipient=user, is_read=False).update(is_read=True)


def send_absence_notification(*, student, date) -> dict:
    """
    FR-17: Send push notification to parent on student absence.
    FR-18: Generate WhatsApp link for parent.
    Creates in-app notification + returns wa.me link.
    """
    result = {"notifications_sent": 0, "whatsapp_links": []}

    # Find linked parents
    parent_links = student.parent_links.select_related("parent", "parent__user").all()

    for link in parent_links:
        parent_user = link.parent.user

        # Create in-app notification
        notification_create(
            recipient=parent_user,
            type="absence",
            title=f"غياب {student.full_name}",
            body=f"تم تسجيل غياب {student.full_name} بتاريخ {date}.",
        )
        result["notifications_sent"] += 1

        # Generate WhatsApp link (FR-18)
        phone = link.parent.phone_number or parent_user.phone_number
        if phone:
            message = quote(
                f"السلام عليكم\nنحيطكم علماً بأن الطالب {student.full_name} "
                f"لم يحضر اليوم {date}.\nمركز نور الهدى لتحفيظ القرآن الكريم"
            )
            wa_link = f"https://wa.me/{phone}?text={message}"
            result["whatsapp_links"].append(wa_link)

    # TODO: Send FCM push notification via Firebase in production

    return result
