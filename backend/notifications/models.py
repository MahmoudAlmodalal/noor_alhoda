import uuid

from django.db import models

from accounts.models import User


class Notification(models.Model):
    """
    In-app notification model.
    FR-20: Store every notification with is_read status.
    """

    class NotificationType(models.TextChoices):
        ABSENCE = "absence", "غياب"
        ANNOUNCEMENT = "announcement", "إعلان"
        REMINDER = "reminder", "تذكير"
        REPORT = "report", "تقرير"
        TEACHER_REQUEST = "teacher_request", "طلب محفظ"
        DIRECT_MESSAGE = "direct_message", "رسالة مباشرة"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="المستلم",
    )
    type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        verbose_name="نوع الإشعار",
    )
    title = models.CharField(max_length=200, verbose_name="العنوان")
    body = models.TextField(verbose_name="النص")
    is_read = models.BooleanField(default=False, verbose_name="مقروء")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = "إشعار"
        verbose_name_plural = "الإشعارات"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "-created_at"]),
            models.Index(fields=["recipient", "is_read"]),
        ]

    def __str__(self):
        return f"{self.title} → {self.recipient.phone_number}"

class DirectMessage(models.Model):
    """
    رسالة مباشرة في محادثة بين محفظ وطالب.
    تُخزّن كل رسالة مع مرسلها والطالب المعني بالمحادثة.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_direct_messages",
        verbose_name="المرسل",
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="direct_messages",
        verbose_name="الطالب",
    )
    sender_role = models.CharField(
        max_length=10,
        choices=[
            ("teacher", "محفظ"),
            ("student", "طالب"),
            ("admin", "مدير"),
        ],
        verbose_name="دور المرسل",
    )
    body = models.TextField(verbose_name="نص الرسالة")
    is_read = models.BooleanField(default=False, verbose_name="مقروءة")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "رسالة مباشرة"
        verbose_name_plural = "الرسائل المباشرة"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["student", "created_at"]),
            models.Index(fields=["sender", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.sender} → {self.student} ({self.created_at:%Y-%m-%d %H:%M})"
