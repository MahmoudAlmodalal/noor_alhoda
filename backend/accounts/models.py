import uuid
import hashlib

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class UserManager(BaseUserManager):
    """User manager that authenticates and creates users by national ID."""

    use_in_migrations = True

    def _create_user(self, national_id, password, **extra_fields):
        if not national_id:
            raise ValueError("The given national ID must be set")

        user = self.model(national_id=national_id, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, national_id, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("is_active", True)
        return self._create_user(national_id, password, **extra_fields)

    def create_superuser(self, national_id, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(national_id, password, **extra_fields)


class User(AbstractUser):
    """
    Custom user model with UUID PK, national ID-based login, and role system.
    Roles: admin, teacher, student, parent.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "مدير"
        TEACHER = "teacher", "محفظ"
        STUDENT = "student", "طالب"
        PARENT = "parent", "ولي أمر"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    national_id = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="رقم الهوية",
        help_text="يُستخدم لتسجيل الدخول",
    )
    phone_number = models.CharField(
        max_length=15,
        blank=True,
        verbose_name="رقم الجوال",
        help_text="يُستخدم للتواصل والإشعارات",
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
    failed_login_attempts = models.PositiveIntegerField(default=0)
    lockout_until = models.DateTimeField(null=True, blank=True)
    last_login_attempt = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    # Standard Django field for active users
    is_active = models.BooleanField(default=True, verbose_name="نشط")

    # Use national_id as the login field
    username = None
    USERNAME_FIELD = "national_id"
    REQUIRED_FIELDS = ["first_name", "last_name"]
    objects = UserManager()

    class Meta:
        verbose_name = "مستخدم"
        verbose_name_plural = "المستخدمون"
        ordering = ["-date_joined"]
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["national_id"]),
        ]

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"


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
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = "ولي أمر"
        verbose_name_plural = "أولياء الأمور"
        ordering = ["full_name"]
        indexes = [
            models.Index(fields=["full_name"]),
            models.Index(fields=["phone_number"]),
        ]

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
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = "ربط ولي أمر بطالب"
        verbose_name_plural = "ربط أولياء الأمور بالطلاب"
        unique_together = ("parent", "student")

    def __str__(self):
        return f"{self.parent.full_name} → {self.student.full_name}"


class StaffMember(models.Model):
    """
    Non-teaching staff (Director, Deputy Director, Administrator, Media).
    Plain HR record — no required login. The optional `user` link lets an
    admin promote a staff member to a real account later.
    """

    class MaritalStatus(models.TextChoices):
        SINGLE = "single", "أعزب"
        MARRIED = "married", "متزوج"

    class JobTitle(models.TextChoices):
        DIRECTOR = "director", "مدير المركز"
        DEPUTY_DIRECTOR = "deputy_director", "نائب المدير"
        ADMIN = "admin", "الإداري"
        MEDIA = "media", "إعلامي"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=100, verbose_name="الاسم الكامل")
    national_id = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="رقم الهوية",
        help_text="قد يكون هوية حقيقية أو معرف اصطناعي يبدأ بـ 99",
    )
    phone_number = models.CharField(
        max_length=15,
        blank=True,
        default="",
        verbose_name="رقم التواصل",
    )
    birthdate = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاريخ الميلاد",
    )
    marital_status = models.CharField(
        max_length=10,
        choices=MaritalStatus.choices,
        blank=True,
        default="",
        verbose_name="الحالة الاجتماعية",
    )
    education_qualification = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="المؤهل العلمي",
    )
    last_tajweed_course = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="آخر دورة تجويد",
    )
    family_members_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="عدد أفراد الأسرة",
    )
    wallet_name = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="اسم المحفظة",
    )
    wallet_number = models.CharField(
        max_length=30,
        blank=True,
        default="",
        verbose_name="رقم المحفظة",
    )
    job_title = models.CharField(
        max_length=30,
        choices=JobTitle.choices,
        verbose_name="المسمى الوظيفي",
    )
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_profile",
        verbose_name="حساب المستخدم",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = "موظف"
        verbose_name_plural = "الموظفون"
        ordering = ["job_title", "full_name"]
        indexes = [
            models.Index(fields=["full_name"]),
            models.Index(fields=["job_title"]),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.get_job_title_display()})"


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
        return f"OTP for {self.user.national_id}"

    @staticmethod
    def hash_code(code: str) -> str:
        """Hash OTP code using SHA-256."""
        return hashlib.sha256(code.encode()).hexdigest()
