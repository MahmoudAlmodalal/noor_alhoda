import uuid
import hashlib

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model with UUID PK, phone-based login, and role system.
    Roles: admin, teacher, student, parent.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "مدير"
        TEACHER = "teacher", "محفظ"
        STUDENT = "student", "طالب"
        PARENT = "parent", "ولي أمر"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = models.CharField(
        max_length=15,
        unique=True,
        verbose_name="رقم الجوال",
        help_text="يُستخدم لتسجيل الدخول والإشعارات",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
        verbose_name="الدور",
    )
    fcm_token = models.TextField(
        blank=True,
        null=True,
        verbose_name="رمز FCM",
        help_text="رمز الجهاز لإشعارات Firebase",
    )
    failed_login_attempts = models.PositiveIntegerField(
        default=0,
        verbose_name="محاولات الدخول الفاشلة",
    )
    locked_until = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="مقفل حتى",
    )

    # Use phone_number as the login field
    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = ["username", "first_name", "last_name"]

    class Meta:
        verbose_name = "مستخدم"
        verbose_name_plural = "المستخدمون"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"


class Teacher(models.Model):
    """Teacher profile linked to a User with role=teacher."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="teacher_profile",
        verbose_name="حساب المستخدم",
    )
    full_name = models.CharField(max_length=100, verbose_name="الاسم الكامل")
    specialization = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="التخصص",
        help_text="التخصص أو الإجازة القرآنية",
    )
    session_days = models.JSONField(
        default=list,
        blank=True,
        verbose_name="أيام الحلقة",
        help_text='مثال: ["sat", "sun", "mon", "tue", "wed", "thu"]',
    )
    max_students = models.PositiveIntegerField(
        default=25,
        verbose_name="أقصى عدد طلاب",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "محفظ"
        verbose_name_plural = "المحفظون"
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class Parent(models.Model):
    """Parent profile linked to a User with role=parent."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="parent_profile",
        verbose_name="حساب المستخدم",
    )
    full_name = models.CharField(max_length=100, verbose_name="الاسم الكامل")
    phone_number = models.CharField(
        max_length=15,
        blank=True,
        verbose_name="رقم التواصل",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "ولي أمر"
        verbose_name_plural = "أولياء الأمور"
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class ParentStudentLink(models.Model):
    """Many-to-many bridge between parents and students."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.ForeignKey(
        Parent,
        on_delete=models.CASCADE,
        related_name="student_links",
        verbose_name="ولي الأمر",
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="parent_links",
        verbose_name="الطالب",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "ربط ولي أمر بطالب"
        verbose_name_plural = "ربط أولياء الأمور بالطلاب"
        unique_together = ("parent", "student")

    def __str__(self):
        return f"{self.parent.full_name} → {self.student.full_name}"


class OTPCode(models.Model):
    """
    One-time password for password reset.
    Stores hashed code (FR-05), expires after 10 minutes (FR-04).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="otp_codes",
        verbose_name="المستخدم",
    )
    code_hash = models.CharField(max_length=64, verbose_name="رمز OTP المشفر")
    expires_at = models.DateTimeField(verbose_name="تاريخ الانتهاء")
    is_used = models.BooleanField(default=False, verbose_name="مستخدم")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "رمز OTP"
        verbose_name_plural = "رموز OTP"
        ordering = ["-created_at"]

    def __str__(self):
        return f"OTP for {self.user.phone_number}"

    @staticmethod
    def hash_code(code: str) -> str:
        """Hash OTP code using SHA-256."""
        return hashlib.sha256(code.encode()).hexdigest()
