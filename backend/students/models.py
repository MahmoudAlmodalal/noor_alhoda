import uuid

from django.db import models

from accounts.models import User, Teacher


class Ring(models.Model):
    """
    Quran Ring (Halaqa) model.
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "نشطة"
        INACTIVE = "inactive", "متوقفة"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name="اسم الحلقة")
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rings",
        verbose_name="المحفظ المسؤول",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="الحالة",
    )
    level = models.CharField(max_length=50, blank=True, verbose_name="المستوى")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "حلقة"
        verbose_name_plural = "الحلقات"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Student(models.Model):
    """
    Student profile with full registration data.
    Linked to User (OneToOne) and Teacher (FK).
    """

    class HealthStatus(models.TextChoices):
        NORMAL = "normal", "طبيعي"
        MARTYR_SON = "martyr_son", "ابن شهيد"
        INJURED = "injured", "جريح"
        SICK = "sick", "مريض"
        OTHER = "other", "أخرى"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="student_profile",
        verbose_name="حساب المستخدم",
    )
    full_name = models.CharField(max_length=100, verbose_name="الاسم الرباعي")
    national_id = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="رقم الهوية",
    )
    birthdate = models.DateField(verbose_name="تاريخ الميلاد")
    grade = models.CharField(max_length=50, verbose_name="الصف الدراسي")
    address = models.TextField(blank=True, null=True, verbose_name="عنوان السكن")
    whatsapp = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        verbose_name="رقم واتساب",
    )
    mobile = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        verbose_name="رقم الجوال",
    )
    previous_courses = models.TextField(
        blank=True,
        default="",
        verbose_name="الدورات السابقة",
    )
    desired_courses = models.TextField(
        blank=True,
        default="",
        verbose_name="الدورات المطلوب الالتحاق بها",
    )
    bank_account_number = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        verbose_name="رقم الحساب",
    )
    bank_account_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="اسم الحساب",
    )
    bank_account_type = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name="نوع الحساب",
    )
    guardian_name = models.CharField(
        max_length=100,
        default="",
        verbose_name="اسم ولي الأمر",
    )
    guardian_national_id = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name="رقم هوية ولي الأمر",
    )
    guardian_mobile = models.CharField(
        max_length=15,
        default="",
        verbose_name="رقم جوال ولي الأمر",
    )
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
        verbose_name="المحفظ المسؤول",
    )
    ring = models.ForeignKey(
        Ring,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
        verbose_name="الحلقة",
    )
    health_status = models.CharField(
        max_length=20,
        choices=HealthStatus.choices,
        default=HealthStatus.NORMAL,
        verbose_name="الحالة الصحية",
    )
    health_note = models.TextField(
        blank=True,
        verbose_name="تفاصيل الحالة الصحية",
    )
    skills = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="المهارات",
        help_text='{"quran": true, "nasheed": false, "poetry": false, "other": false}',
    )
    photo = models.ImageField(
        upload_to="students/photos/",
        blank=True,
        null=True,
        verbose_name="صورة الطالب",
    )
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    enrollment_date = models.DateField(auto_now_add=True, verbose_name="تاريخ الالتحاق")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "طالب"
        verbose_name_plural = "الطلاب"
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name
