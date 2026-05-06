import uuid

from django.db import models

from accounts.models import User


class Teacher(models.Model):
    """Teacher profile linked to a User with role=teacher."""

    class Affiliation(models.TextChoices):
        DAR_QURAN = "dar_quran", "دار القرآن"
        AWQAF = "awqaf", "أوقاف"
        SHEIKH_TABAEA = "sheikh_tabaea", "شيخ التباعية"

    class MaritalStatus(models.TextChoices):
        SINGLE = "single", "أعزب"
        MARRIED = "married", "متزوج"

    class JobTitle(models.TextChoices):
        TEACHER = "teacher", "محفظ"
        TEACHER_RECEPTION = "teacher_reception", "محفظ استقبال"
        TEACHER_YEAR_CIRCLE = "teacher_year_circle", "محفظ حلقة سنة"
        TEACHER_FORUM_CIRCLE = "teacher_forum_circle", "محفظ حلقة منتدى"
        TEACHER_ASSISTANT = "teacher_assistant", "مساعد محفظ"
        COURSE_INSTRUCTOR = "course_instructor", "معلم دورات"
        ADMIN_TEACHER = "admin_teacher", "مساعد إداري + محفظ"
        DIRECTOR = "director", "مدير المركز"
        DEPUTY_DIRECTOR = "deputy_director", "نائب المدير"
        ADMIN = "admin", "إداري"
        MEDIA = "media", "إعلامي"

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
    affiliation = models.CharField(
        max_length=20,
        choices=Affiliation.choices,
        blank=True,
        default="",
        verbose_name="التباعية",
    )
    ring_name = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="اسم الحلقة",
    )
    courses = models.ManyToManyField(
        "courses.Course",
        related_name="teachers",
        blank=True,
        verbose_name="الدورات",
        db_table="accounts_teacher_courses",
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
        blank=True,
        default=JobTitle.TEACHER,
        verbose_name="المسمى الوظيفي",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        db_table = "accounts_teacher"
        verbose_name = "محفظ"
        verbose_name_plural = "المحفظون"
        ordering = ["full_name"]
        indexes = [
            models.Index(fields=["full_name"], name="accounts_te_full_na_631c53_idx"),
            models.Index(fields=["affiliation"], name="accounts_te_affilia_772e0f_idx"),
        ]

    def __str__(self):
        return self.full_name
