from django.urls import path

from backend.reports.views.report_views import (
    DashboardApi,
    AttendanceReportApi,
    StudentPDFReportApi,
    LeaderboardApi,
)

urlpatterns = [
    path("dashboard/", DashboardApi.as_view(), name="report-dashboard"),
    path("attendance/", AttendanceReportApi.as_view(), name="report-attendance"),
    path("student/<uuid:student_id>/pdf/", StudentPDFReportApi.as_view(), name="report-student-pdf"),
    path("leaderboard/", LeaderboardApi.as_view(), name="report-leaderboard"),
]
