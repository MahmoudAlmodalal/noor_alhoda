import uuid

from django.db import models

from backend.accounts.models import User
from backend.students.models import Student


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
    total_required = models.PositiveIntegerField(default=0, verbose_name="إجمالي الآيات المطلوبة")
    total_achieved = models.PositiveIntegerField(default=0, verbose_name="إجمالي الآيات المنجزة")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "خطة أسبوعية"
        verbose_name_plural = "الخطط الأسبوعية"
        ordering = ["-week_start"]
        unique_together = ("student", "week_start")

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
    required_verses = models.PositiveIntegerField(default=0, verbose_name="الآيات المطلوبة")
    achieved_verses = models.PositiveIntegerField(default=0, verbose_name="الآيات المنجزة")
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

    def __str__(self):
        return f"{self.weekly_plan.student.full_name} - {self.get_day_display()} ({self.date})"
