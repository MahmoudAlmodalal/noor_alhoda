import uuid

from django.db import models

from backend.accounts.models import User


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

    class Meta:
        verbose_name = "إشعار"
        verbose_name_plural = "الإشعارات"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} → {self.recipient.phone_number}"
