import uuid
from decimal import Decimal
from datetime import timedelta

import django.db.models.deletion
from django.db import migrations, models


def backfill_surah_mastery(apps, schema_editor):
    """
    Seed a SurahMastery row for every (student, surah) the student has
    already memorized with quality >= acceptable. This lets the adaptive
    review pool start with a sensible schedule instead of an empty table.
    """
    SurahMastery = apps.get_model("records", "SurahMastery")
    DailyRecord = apps.get_model("records", "DailyRecord")
    ReviewRecord = apps.get_model("records", "ReviewRecord")
    Student = apps.get_model("students", "Student")

    memorized = (
        DailyRecord.objects.filter(
            quality__in=["excellent", "good", "acceptable"],
        )
        .exclude(surah_name="")
        .values("weekly_plan__student_id", "surah_name")
        .annotate(last_memorized=models.Max("date"))
    )

    students_by_id = {s.id: s for s in Student.objects.only("id", "review_interval_days")}

    batch = []
    for row in memorized.iterator(chunk_size=500):
        student_id = row["weekly_plan__student_id"]
        surah_name = row["surah_name"]
        last_memorized = row["last_memorized"]

        if SurahMastery.objects.filter(
            student_id=student_id, surah_name=surah_name
        ).exists():
            continue

        student = students_by_id.get(student_id)
        interval_base = getattr(student, "review_interval_days", None) or 14

        last_review = (
            ReviewRecord.objects.filter(
                student_id=student_id, surah_name=surah_name
            )
            .order_by("-reviewed_date")
            .first()
        )
        base_date = last_review.reviewed_date if last_review else last_memorized

        batch.append(
            SurahMastery(
                student_id=student_id,
                surah_name=surah_name,
                ease_factor=Decimal("2.50"),
                interval_days=interval_base,
                next_due_date=base_date + timedelta(days=interval_base),
                streak=0,
                lapses=0,
                last_reviewed_at=last_review.reviewed_date if last_review else None,
            )
        )
        if len(batch) >= 500:
            SurahMastery.objects.bulk_create(batch, ignore_conflicts=True)
            batch = []

    if batch:
        SurahMastery.objects.bulk_create(batch, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ("records", "0005_add_updated_at"),
        ("students", "0012_alter_student_teacher_fk"),
    ]

    operations = [
        migrations.CreateModel(
            name="SurahMastery",
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
                    "surah_name",
                    models.CharField(max_length=100, verbose_name="اسم السورة"),
                ),
                (
                    "ease_factor",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("2.50"),
                        max_digits=3,
                        verbose_name="معامل السهولة",
                    ),
                ),
                (
                    "interval_days",
                    models.PositiveIntegerField(
                        default=1, verbose_name="الفاصل الزمني (أيام)"
                    ),
                ),
                (
                    "next_due_date",
                    models.DateField(
                        db_index=True, verbose_name="تاريخ الاستحقاق القادم"
                    ),
                ),
                ("streak", models.PositiveIntegerField(default=0, verbose_name="التتابع")),
                (
                    "lapses",
                    models.PositiveIntegerField(default=0, verbose_name="مرات التعثّر"),
                ),
                (
                    "last_reviewed_at",
                    models.DateField(blank=True, null=True, verbose_name="آخر مراجعة"),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="آخر تحديث"),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="surah_masteries",
                        to="students.student",
                        verbose_name="الطالب",
                    ),
                ),
            ],
            options={
                "verbose_name": "إتقان سورة",
                "verbose_name_plural": "إتقان السور",
                "ordering": ["next_due_date", "ease_factor"],
                "unique_together": {("student", "surah_name")},
            },
        ),
        migrations.AddIndex(
            model_name="surahmastery",
            index=models.Index(
                fields=["student", "next_due_date"],
                name="records_sur_student_b18c46_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="surahmastery",
            index=models.Index(
                fields=["student", "surah_name"],
                name="records_sur_student_1d5969_idx",
            ),
        ),
        migrations.RunPython(
            backfill_surah_mastery, reverse_code=migrations.RunPython.noop
        ),
    ]
