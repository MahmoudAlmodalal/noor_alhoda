from urllib.parse import quote

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound, PermissionDenied

from notifications.models import Notification
from notifications.selectors.notification_selectors import (
    announcement_recipients,
    parent_users_get_for_student,
    parents_of_student_with_phone,
    student_get_by_id,
    teacher_can_message_student,
)
from accounts.models import User
from core.permissions import is_admin_user


@transaction.atomic
def announcement_send(*, sender: User, title: str, body: str, target_roles: list = None, target_user_ids: list = None) -> int:
    """
    FR-25: Director sends announcement to all users or specific groups.
    Returns count of notifications created.
    """
    if not is_admin_user(sender):
        raise PermissionDenied("فقط المدير يمكنه إرسال الإعلانات.")

    recipients = announcement_recipients(
        sender=sender,
        target_user_ids=target_user_ids,
        target_roles=target_roles,
    )

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

    for _parent, parent_user, phone in parents_of_student_with_phone(student=student):
        notification_create(
            recipient=parent_user,
            type="absence",
            title=f"غياب {student.full_name}",
            body=f"تم تسجيل غياب {student.full_name} بتاريخ {date}.",
        )
        result["notifications_sent"] += 1

        if phone:
            formatted_phone = phone.strip()
            if formatted_phone.startswith("0"):
                formatted_phone = f"966{formatted_phone[1:]}"

            message = quote(
                f"السلام عليكم\nنحيطكم علماً بأن الطالب {student.full_name} "
                f"لم يحضر اليوم {date}.\nمركز نور الهدى لتحفيظ القرآن الكريم"
            )
            wa_link = f"https://wa.me/{formatted_phone}?text={message}"
            result["whatsapp_links"].append(wa_link)

    # TODO: Send FCM push notification via Firebase in production

    return result


@transaction.atomic
def direct_message_send(
    *,
    sender: User,
    student_id: str,
    title: str,
    body: str,
) -> dict:
    """
    Send a targeted private message to a specified student and linked parent account(s).
    Enforces teacher circle RBAC (admin users bypass circle check).
    """
    student = student_get_by_id(student_id)
    if not student:
        raise NotFound("الطالب غير موجود.")

    if not is_admin_user(sender):
        if not teacher_can_message_student(sender, student=student):
            raise PermissionDenied("ليس لديك صلاحية لإرسال رسالة مباشرة لهذا الطالب (خارج حلقتك).")

    recipients: list[User] = []
    student_user = getattr(student, "user", None)
    if student_user:
        recipients.append(student_user)

    parent_users = parent_users_get_for_student(student=student)
    for p_user in parent_users:
        if p_user not in recipients:
            recipients.append(p_user)

    notifications = [
        Notification(
            recipient=user,
            type=Notification.NotificationType.DIRECT_MESSAGE,
            title=title,
            body=body,
        )
        for user in recipients
    ]
    if notifications:
        Notification.objects.bulk_create(notifications)

    return {
        "student_id": str(student.id),
        "notifications_created": len(notifications),
        "recipients_count": len(recipients),
    }

