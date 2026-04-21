"""
Adds `updated_at` to User, Teacher, Parent, ParentStudentLink so delta sync
(`/api/sync/pull/?since=...`) no longer silently drops edits to these rows.

Two-phase so the new column can be backfilled before flipping to non-null:
    1. AddField(null=True) on each model.
    2. RunPython copies `created_at` (or `date_joined` for User) into the
       new column using `.update()` which bypasses auto_now.
    3. AlterField to the final shape (auto_now=True, null=False).
"""
from django.db import migrations, models
from django.db.models import F


def backfill_updated_at(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.update(updated_at=F("date_joined"))
    Teacher = apps.get_model("accounts", "Teacher")
    Teacher.objects.update(updated_at=F("created_at"))
    Parent = apps.get_model("accounts", "Parent")
    Parent.objects.update(updated_at=F("created_at"))
    ParentStudentLink = apps.get_model("accounts", "ParentStudentLink")
    ParentStudentLink.objects.update(updated_at=F("created_at"))


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0016_teacher_ring_name_teacher_courses"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="teacher",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="parent",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="parentstudentlink",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.RunPython(backfill_updated_at, noop_reverse),
        migrations.AlterField(
            model_name="user",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, verbose_name="آخر تحديث"),
        ),
        migrations.AlterField(
            model_name="teacher",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, verbose_name="آخر تحديث"),
        ),
        migrations.AlterField(
            model_name="parent",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, verbose_name="آخر تحديث"),
        ),
        migrations.AlterField(
            model_name="parentstudentlink",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, verbose_name="آخر تحديث"),
        ),
    ]
