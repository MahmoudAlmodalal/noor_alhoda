"""
Adds `updated_at` to Notification for delta sync coverage (mark-read needs
to propagate across devices).
"""
from django.db import migrations, models
from django.db.models import F


def backfill_updated_at(apps, schema_editor):
    Notification = apps.get_model("notifications", "Notification")
    Notification.objects.update(updated_at=F("created_at"))


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.RunPython(backfill_updated_at, noop_reverse),
        migrations.AlterField(
            model_name="notification",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, verbose_name="آخر تحديث"),
        ),
    ]
