from django.contrib import admin

from .models import WeeklyPlan, DailyRecord


class DailyRecordInline(admin.TabularInline):
    model = DailyRecord
    extra = 0
    fields = ("day", "date", "attendance", "required_verses", "achieved_verses", "quality", "note")


@admin.register(WeeklyPlan)
class WeeklyPlanAdmin(admin.ModelAdmin):
    list_display = ("student", "week_number", "week_start", "total_required", "total_achieved", "completion_rate")
    list_filter = ("week_start",)
    search_fields = ("student__full_name",)
    inlines = [DailyRecordInline]


@admin.register(DailyRecord)
class DailyRecordAdmin(admin.ModelAdmin):
    list_display = ("weekly_plan", "day", "date", "attendance", "achieved_verses", "quality")
    list_filter = ("attendance", "quality", "day")
    search_fields = ("weekly_plan__student__full_name",)
