from decimal import Decimal

from django.conf import settings
from django.db.models import Sum
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from records.models import DailyRecord


@receiver(post_save, sender=DailyRecord, dispatch_uid="records.update_weekly_plan_totals")
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
    plan.save(update_fields=["total_required", "total_achieved", "updated_at"])


@receiver(post_save, sender=DailyRecord, dispatch_uid="records.infer_daily_record_result")
def infer_daily_record_result(sender, instance, **kwargs):
    """
    Auto-set DailyRecord.result based on the achieved/required ratio.

    Fires only when result is currently PENDING — preserves any explicit
    teacher override (pass/fail). Skips absences and excused days
    (kept pending) and zero-target days. Uses queryset .update() to
    avoid signal recursion.
    """
    if instance.result != DailyRecord.Result.PENDING:
        return
    if instance.required_verses <= 0:
        return
    if instance.attendance not in (
        DailyRecord.Attendance.PRESENT,
        DailyRecord.Attendance.LATE,
    ):
        return

    threshold = Decimal(str(getattr(settings, "RECORD_PASS_THRESHOLD", "0.8")))
    ratio = Decimal(instance.achieved_verses) / Decimal(instance.required_verses)
    new_result = (
        DailyRecord.Result.PASS
        if ratio >= threshold
        else DailyRecord.Result.FAIL
    )
    DailyRecord.objects.filter(pk=instance.pk).update(
        result=new_result,
        updated_at=timezone.now(),
    )
