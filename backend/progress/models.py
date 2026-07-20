import uuid

from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models

from students.models import Student
from teacher.models import Teacher


class StudentProgress(models.Model):
    """
    Chronological log of a student's Quran memorization progress.
    Each entry records which Surah/Juz/pages the student has reached,
    recorded by their teacher.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="progress_entries",
        verbose_name="الطالب",
    )
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_progress",
        verbose_name="المحفظ المسجّل",
    )
    surah_number = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(114)],
        verbose_name="رقم السورة",
    )
    surah_name = models.CharField(
        max_length=50,
        verbose_name="اسم السورة",
        help_text="يُملأ تلقائياً من رقم السورة",
    )
    juz_number = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(30)],
        verbose_name="رقم الجزء",
    )
    from_ayah = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="من آية",
    )
    to_ayah = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="إلى آية",
    )
    TYPE_CHOICES = [
        ("memorization", "memorization"),
        ("revision", "revision"),
    ]
    type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default="memorization",
        verbose_name="نوع التقدم",
    )
    note = models.TextField(
        blank=True,
        default="",
        verbose_name="ملاحظة",
    )
    recorded_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاريخ التسجيل",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = "تقدم حفظ"
        verbose_name_plural = "سجل تقدم الحفظ"
        ordering = ["-recorded_at"]
        indexes = [
            models.Index(fields=["student", "-recorded_at"]),
            models.Index(fields=["student", "surah_number"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} - {self.surah_name} (جزء {self.juz_number})"
