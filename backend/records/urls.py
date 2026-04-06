from django.urls import path

from backend.records.views.record_views import (
    DailyRecordListApi,
    DailyRecordCreateApi,
    DailyRecordUpdateApi,
    BulkAttendanceApi,
    WeeklySummaryApi,
    WeeklyPlanCreateApi,
)

urlpatterns = [
    path("", DailyRecordListApi.as_view(), name="record-list"),
    path("create/", DailyRecordCreateApi.as_view(), name="record-create"),
    path("<uuid:record_id>/", DailyRecordUpdateApi.as_view(), name="record-update"),
    path("bulk-attendance/", BulkAttendanceApi.as_view(), name="bulk-attendance"),
    path("weekly-summary/<uuid:student_id>/", WeeklySummaryApi.as_view(), name="weekly-summary"),
    path("weekly-plans/", WeeklyPlanCreateApi.as_view(), name="weekly-plan-create"),
]
