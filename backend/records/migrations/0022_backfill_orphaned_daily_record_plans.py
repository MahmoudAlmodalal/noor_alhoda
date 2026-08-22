from datetime import timedelta

from django.db import migrations
from django.db.models import Sum


def saturday_for_date(record_date):
    return record_date - timedelta(days=(record_date.weekday() + 2) % 7)


def backfill_orphaned_daily_record_plans(apps, schema_editor):
    WeeklyPlan = apps.get_model("records", "WeeklyPlan")
    DailyRecord = apps.get_model("records", "DailyRecord")

    touched_plan_ids = set()
    orphaned_records = DailyRecord.objects.filter(weekly_plan__isnull=True).order_by("date")

    for record in orphaned_records.iterator():
        month_plan = (
            WeeklyPlan.objects
            .filter(student_id=record.student_id, month_start=record.date.replace(day=1))
            .order_by("-updated_at")
            .first()
        )
        plan = month_plan
        if plan is None:
            plan = (
                WeeklyPlan.objects
                .filter(
                    student_id=record.student_id,
                    month_start__isnull=True,
                    week_start=saturday_for_date(record.date),
                )
                .first()
            )

        if plan is None:
            continue

        DailyRecord.objects.filter(pk=record.pk, weekly_plan__isnull=True).update(
            weekly_plan_id=plan.pk
        )
        touched_plan_ids.add(plan.pk)

    for plan_id in touched_plan_ids:
        totals = DailyRecord.objects.filter(weekly_plan_id=plan_id).aggregate(
            total_required=Sum("required_verses"),
            total_achieved=Sum("achieved_verses"),
            total_lines=Sum("memorized_lines"),
        )
        WeeklyPlan.objects.filter(pk=plan_id).update(
            total_required=totals["total_required"] or 0,
            total_achieved=totals["total_achieved"] or 0,
            total_lines=totals["total_lines"] or 0,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("records", "0021_dailyrecord_review_lines"),
    ]

    operations = [
        migrations.RunPython(
            backfill_orphaned_daily_record_plans,
            migrations.RunPython.noop,
        ),
    ]
