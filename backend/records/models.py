import uuid
from decimal import Decimal

from django.db import models

from accounts.models import User
from students.models import Student


class WeeklyPlan(models.Model):
    """
    Weekly memorization plan for a student.
    Saturday through Thursday (6 working days).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="weekly_plans",
        verbose_name="الطالب",
    )
    week_number = models.PositiveIntegerField(verbose_name="رقم الأسبوع")
    week_start = models.DateField(verbose_name="بداية الأسبوع (السبت)")
    total_required = models.PositiveIntegerField(default=0, verbose_name="إجمالي الصفحات المطلوبة")
    total_achieved = models.PositiveIntegerField(default=0, verbose_name="إجمالي الصفحات المنجزة")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = "خطة أسبوعية"
        verbose_name_plural = "الخطط الأسبوعية"
        ordering = ["-week_start"]
        unique_together = ("student", "week_start")
        indexes = [
            models.Index(fields=["week_start"]),
            models.Index(fields=["week_number"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} - الأسبوع {self.week_number}"

    @property
    def completion_rate(self):
        """Calculate completion rate as percentage."""
        if self.total_required == 0:
            return 0
        return round((self.total_achieved / self.total_required) * 100, 2)


class DailyRecord(models.Model):
    """
    Daily record for attendance and memorization tracking.
    One per student per day per weekly plan.
    """

    class Day(models.TextChoices):
        SAT = "sat", "السبت"
        SUN = "sun", "الأحد"
        MON = "mon", "الاثنين"
        TUE = "tue", "الثلاثاء"
        WED = "wed", "الأربعاء"
        THU = "thu", "الخميس"

    class Attendance(models.TextChoices):
        PRESENT = "present", "حاضر"
        ABSENT = "absent", "غائب"
        LATE = "late", "متأخر"
        EXCUSED = "excused", "مستأذن"

    class Quality(models.TextChoices):
        EXCELLENT = "excellent", "ممتاز"
        GOOD = "good", "جيد جداً"
        ACCEPTABLE = "acceptable", "جيد"
        WEAK = "weak", "ضعيف"
        NONE = "none", "لم يُسمّع"

    class Result(models.TextChoices):
        PASS = "pass", "ناجح"
        FAIL = "fail", "راسب"
        PENDING = "pending", "معلّق"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    weekly_plan = models.ForeignKey(
        WeeklyPlan,
        on_delete=models.CASCADE,
        related_name="daily_records",
        verbose_name="الخطة الأسبوعية",
    )
    day = models.CharField(
        max_length=3,
        choices=Day.choices,
        verbose_name="اليوم",
    )
    date = models.DateField(verbose_name="التاريخ")
    attendance = models.CharField(
        max_length=10,
        choices=Attendance.choices,
        default=Attendance.PRESENT,
        verbose_name="الحضور",
    )
    required_verses = models.PositiveIntegerField(default=0, verbose_name="الصفحات المطلوبة")
    achieved_verses = models.PositiveIntegerField(default=0, verbose_name="الصفحات المنجزة")
    surah_name = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="اسم السورة",
    )
    quality = models.CharField(
        max_length=10,
        choices=Quality.choices,
        default=Quality.NONE,
        verbose_name="جودة الحفظ",
    )
    note = models.TextField(blank=True, verbose_name="ملاحظة المحفظ")
    result = models.CharField(
        max_length=10,
        choices=Result.choices,
        default=Result.PENDING,
        verbose_name="النتيجة",
    )
    recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="recorded_records",
        verbose_name="المسجّل",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "سجل يومي"
        verbose_name_plural = "السجلات اليومية"
        unique_together = ("weekly_plan", "day")
        ordering = ["date"]
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["attendance"]),
            models.Index(fields=["quality"]),
            models.Index(fields=["result"]),
        ]

    def __str__(self):
        return f"{self.weekly_plan.student.full_name} - {self.get_day_display()} ({self.date})"


class ReviewRecord(models.Model):
    """
    Tracks a student's review (مراجعة) of previously-memorized surahs.
    Separate from DailyRecord to avoid the WeeklyPlan totals signal.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="review_records",
        verbose_name="الطالب",
    )
    surah_name = models.CharField(max_length=100, verbose_name="اسم السورة")
    reviewed_date = models.DateField(verbose_name="تاريخ المراجعة")
    quality = models.CharField(
        max_length=10,
        choices=DailyRecord.Quality.choices,
        default=DailyRecord.Quality.NONE,
        verbose_name="جودة المراجعة",
    )
    note = models.TextField(blank=True, default="", verbose_name="ملاحظة")
    recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="recorded_reviews",
        verbose_name="المسجّل",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = "سجل مراجعة"
        verbose_name_plural = "سجلات المراجعة"
        unique_together = ("student", "surah_name", "reviewed_date")
        ordering = ["-reviewed_date"]
        indexes = [
            models.Index(fields=["student", "reviewed_date"]),
            models.Index(fields=["student", "surah_name"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} - {self.surah_name} ({self.reviewed_date})"


class SurahMastery(models.Model):
    """
    Adaptive spaced-repetition state per (student, surah).
    Updated on each ReviewRecord write by review_services. Consumed by the
    review pool selector to schedule the next review.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="surah_masteries",
        verbose_name="الطالب",
    )
    surah_name = models.CharField(max_length=100, verbose_name="اسم السورة")
    ease_factor = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=Decimal("2.50"),
        verbose_name="معامل السهولة",
    )
    interval_days = models.PositiveIntegerField(
        default=1,
        verbose_name="الفاصل الزمني (أيام)",
    )
    next_due_date = models.DateField(
        db_index=True,
        verbose_name="تاريخ الاستحقاق القادم",
    )
    streak = models.PositiveIntegerField(default=0, verbose_name="التتابع")
    lapses = models.PositiveIntegerField(default=0, verbose_name="مرات التعثّر")
    last_reviewed_at = models.DateField(
        null=True, blank=True, verbose_name="آخر مراجعة"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = "إتقان سورة"
        verbose_name_plural = "إتقان السور"
        unique_together = ("student", "surah_name")
        ordering = ["next_due_date", "ease_factor"]
        indexes = [
            models.Index(fields=["student", "next_due_date"]),
            models.Index(fields=["student", "surah_name"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} - {self.surah_name}"
