from django.urls import path

from students.views.student_views import (
    StudentListApi,
    StudentCreateApi,
    StudentBulkCreateApi,
    StudentDetailApi,
    StudentHistoryApi,
    StudentStatsApi,
    StudentAssignTeacherApi,
    StudentLinkParentApi,
)

urlpatterns = [
    path("", StudentListApi.as_view(), name="student-list"),
    path("create/", StudentCreateApi.as_view(), name="student-create"),
    path("bulk-create/", StudentBulkCreateApi.as_view(), name="student-bulk-create"),
    path("<uuid:student_id>/", StudentDetailApi.as_view(), name="student-detail"),
    path("<uuid:student_id>/history/", StudentHistoryApi.as_view(), name="student-history"),
    path("<uuid:student_id>/stats/", StudentStatsApi.as_view(), name="student-stats"),
    path("<uuid:student_id>/assign-teacher/", StudentAssignTeacherApi.as_view(), name="student-assign-teacher"),
    path("<uuid:student_id>/link-parent/", StudentLinkParentApi.as_view(), name="student-link-parent"),
]
