"""
Adds `updated_at` to WeeklyPlan and ReviewRecord for delta sync coverage.
"""
from django.db import migrations, models
from django.db.models import F


def backfill_updated_at(apps, schema_editor):
    WeeklyPlan = apps.get_model("records", "WeeklyPlan")
    WeeklyPlan.objects.update(updated_at=F("created_at"))
    ReviewRecord = apps.get_model("records", "ReviewRecord")
    ReviewRecord.objects.update(updated_at=F("created_at"))


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("records", "0004_reviewrecord"),
    ]

    operations = [
        migrations.AddField(
            model_name="weeklyplan",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="reviewrecord",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.RunPython(backfill_updated_at, noop_reverse),
        migrations.AlterField(
            model_name="weeklyplan",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, verbose_name="آخر تحديث"),
        ),
        migrations.AlterField(
            model_name="reviewrecord",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, verbose_name="آخر تحديث"),
        ),
    ]
