import uuid

from django.db import models

from accounts.models import User
from students.models import Student


class Evaluation(models.Model):
    """Scheduled evaluation/test for a student."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "مجدول"
        PASSED = "passed", "ناجح"
        FAILED = "failed", "راسب"
        MISSED = "missed", "متغيّب"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="evaluations",
        verbose_name="الطالب",
    )
    title = models.CharField(max_length=200, verbose_name="عنوان الاختبار")
    surah_range = models.CharField(
        max_length=200,
        blank=True,
        default="",
        verbose_name="نطاق السور",
    )
    scheduled_date = models.DateField(verbose_name="تاريخ الاختبار")
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.SCHEDULED,
        verbose_name="الحالة",
    )
    result_note = models.TextField(blank=True, default="", verbose_name="ملاحظة النتيجة")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_evaluations",
        verbose_name="أنشأه",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "اختبار"
        verbose_name_plural = "الاختبارات"
        ordering = ["scheduled_date"]
        indexes = [
            models.Index(fields=["student", "scheduled_date"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} - {self.title} ({self.scheduled_date})"
