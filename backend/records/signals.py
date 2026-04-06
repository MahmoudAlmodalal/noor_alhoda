from django.db.models import Sum
from django.db.models.signals import post_save
from django.dispatch import receiver

from backend.records.models import DailyRecord


@receiver(post_save, sender=DailyRecord)
def update_weekly_plan_totals(sender, instance, **kwargs):
    """
    FR-14: Auto-aggregate total_achieved and total_required
    in WeeklyPlan when any DailyRecord is saved.
    """
    plan = instance.weekly_plan
    totals = plan.daily_records.aggregate(
        total_req=Sum("required_verses"),
        total_ach=Sum("achieved_verses"),
    )
    plan.total_required = totals["total_req"] or 0
    plan.total_achieved = totals["total_ach"] or 0
    plan.save(update_fields=["total_required", "total_achieved"])
