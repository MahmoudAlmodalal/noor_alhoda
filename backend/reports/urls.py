from django.urls import path

from reports.views.report_views import (
    DashboardApi,
    AttendanceReportApi,
    StudentPDFReportApi,
    LeaderboardApi,
)

from reports.views.analytics_views import (
    TeacherAnalyticsApi,
    StudentAnalyticsApi,
    AnalyticsPDFApi,
)

urlpatterns = [
    path(
        "teachers/<uuid:teacher_id>/analytics/",
        TeacherAnalyticsApi.as_view(),
        name="teacher-analytics",
    ),
    path(
        "teachers/<uuid:teacher_id>/students/<uuid:student_id>/analytics/",
        StudentAnalyticsApi.as_view(),
        name="teacher-student-analytics",
    ),
    path(
        "teachers/<uuid:teacher_id>/analytics/pdf/",
        AnalyticsPDFApi.as_view(),
        name="teacher-analytics-pdf",
    ),
    path(
        "teachers/<uuid:teacher_id>/students/<uuid:student_id>/analytics/pdf/",
        AnalyticsPDFApi.as_view(),
        name="teacher-student-analytics-pdf",
    ),
    path("dashboard/", DashboardApi.as_view(), name="report-dashboard"),
    path("attendance/", AttendanceReportApi.as_view(), name="report-attendance"),
    path(
        "student/<uuid:student_id>/pdf/",
        StudentPDFReportApi.as_view(),
        name="report-student-pdf",
    ),
    path("leaderboard/", LeaderboardApi.as_view(), name="report-leaderboard"),
]
