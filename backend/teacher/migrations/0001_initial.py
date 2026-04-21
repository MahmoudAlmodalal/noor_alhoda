import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    State-only migration: register the Teacher model under the `teacher` app
    without touching the database. The physical table (`accounts_teacher`) was
    created by `accounts/0001_initial` and is preserved via the Teacher model's
    `Meta.db_table`. The M2M through table is pinned to `accounts_teacher_courses`.
    """

    initial = True

    dependencies = [
        ("accounts", "0017_add_updated_at"),
        ("courses", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="Teacher",
                    fields=[
                        (
                            "id",
                            models.UUIDField(
                                default=uuid.uuid4,
                                editable=False,
                                primary_key=True,
                                serialize=False,
                            ),
                        ),
                        (
                            "full_name",
                            models.CharField(max_length=100, verbose_name="الاسم الكامل"),
                        ),
                        (
                            "specialization",
                            models.CharField(
                                blank=True,
                                help_text="التخصص أو الإجازة القرآنية",
                                max_length=100,
                                verbose_name="التخصص",
                            ),
                        ),
                        (
                            "session_days",
                            models.JSONField(
                                blank=True,
                                default=list,
                                help_text='مثال: ["sat", "sun", "mon", "tue", "wed", "thu"]',
                                verbose_name="أيام الحلقة",
                            ),
                        ),
                        (
                            "max_students",
                            models.PositiveIntegerField(
                                default=25, verbose_name="أقصى عدد طلاب"
                            ),
                        ),
                        (
                            "affiliation",
                            models.CharField(
                                blank=True,
                                choices=[
                                    ("dar_quran", "دار القرآن"),
                                    ("awqaf", "أوقاف"),
                                    ("sheikh_tabaea", "شيخ التباعية"),
                                ],
                                default="",
                                max_length=20,
                                verbose_name="التباعية",
                            ),
                        ),
                        (
                            "ring_name",
                            models.CharField(
                                blank=True,
                                default="",
                                max_length=100,
                                verbose_name="اسم الحلقة",
                            ),
                        ),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                        (
                            "updated_at",
                            models.DateTimeField(auto_now=True, verbose_name="آخر تحديث"),
                        ),
                        (
                            "user",
                            models.OneToOneField(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="teacher_profile",
                                to=settings.AUTH_USER_MODEL,
                                verbose_name="حساب المستخدم",
                            ),
                        ),
                        (
                            "courses",
                            models.ManyToManyField(
                                blank=True,
                                db_table="accounts_teacher_courses",
                                related_name="teachers",
                                to="courses.course",
                                verbose_name="الدورات",
                            ),
                        ),
                    ],
                    options={
                        "db_table": "accounts_teacher",
                        "verbose_name": "محفظ",
                        "verbose_name_plural": "المحفظون",
                        "ordering": ["full_name"],
                    },
                ),
                migrations.AddIndex(
                    model_name="teacher",
                    index=models.Index(
                        fields=["full_name"], name="accounts_te_full_na_631c53_idx"
                    ),
                ),
                migrations.AddIndex(
                    model_name="teacher",
                    index=models.Index(
                        fields=["affiliation"], name="accounts_te_affilia_772e0f_idx"
                    ),
                ),
            ],
            database_operations=[],
        ),
    ]
