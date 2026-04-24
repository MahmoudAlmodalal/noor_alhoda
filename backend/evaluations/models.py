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


class QuizQuestion(models.Model):
    """
    Optional interactive question attached to an Evaluation.
    Groundwork for a future in-app quiz mode — no endpoints are exposed
    yet. Authoring happens through the Django admin; the student-facing UI
    reads a count and conditionally renders a "coming soon" button.
    """

    class QuestionType(models.TextChoices):
        MCQ = "mcq", "اختيار من متعدد"
        FILL_BLANK = "fill_blank", "إكمال فراغ"
        VERSE_CONTINUATION = "verse_continuation", "إكمال آية"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    evaluation = models.ForeignKey(
        Evaluation,
        on_delete=models.CASCADE,
        related_name="questions",
        verbose_name="الاختبار",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="الترتيب")
    prompt = models.TextField(verbose_name="نص السؤال")
    question_type = models.CharField(
        max_length=20,
        choices=QuestionType.choices,
        default=QuestionType.MCQ,
        verbose_name="نوع السؤال",
    )
    options = models.JSONField(
        default=list,
        blank=True,
        verbose_name="الخيارات",
        help_text="لأسئلة الاختيار من متعدد فقط.",
    )
    correct_answer = models.TextField(verbose_name="الإجابة الصحيحة")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "سؤال اختبار"
        verbose_name_plural = "أسئلة الاختبارات"
        ordering = ["evaluation", "order"]
        indexes = [models.Index(fields=["evaluation", "order"])]

    def __str__(self):
        return f"{self.evaluation.title} - سؤال {self.order}"


class QuizAttempt(models.Model):
    """
    Student's attempt at the interactive quiz portion of an Evaluation.
    Groundwork for future auto-grading — no endpoints yet.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    evaluation = models.ForeignKey(
        Evaluation,
        on_delete=models.CASCADE,
        related_name="attempts",
        verbose_name="الاختبار",
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="quiz_attempts",
        verbose_name="الطالب",
    )
    started_at = models.DateTimeField(auto_now_add=True, verbose_name="بدأ في")
    submitted_at = models.DateTimeField(
        null=True, blank=True, verbose_name="سُلِّم في"
    )
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="الدرجة",
    )
    answers = models.JSONField(default=dict, blank=True, verbose_name="الإجابات")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "محاولة اختبار"
        verbose_name_plural = "محاولات الاختبارات"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["evaluation", "student"]),
            models.Index(fields=["student", "started_at"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} - {self.evaluation.title}"
