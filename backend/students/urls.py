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
    StudentTasksTodayApi,
    StudentReviewCompleteApi,
    StudentReviewIntervalApi,
)
from students.views.student_export_views import StudentExportApi
from students.views.change_request_views import (
    ChangeRequestListCreateApi,
    ChangeRequestApproveApi,
    ChangeRequestRejectApi,
    ChangeRequestCancelApi,
)

urlpatterns = [
    path("", StudentListApi.as_view(), name="student-list"),
    path("create/", StudentCreateApi.as_view(), name="student-create"),
    path("bulk-create/", StudentBulkCreateApi.as_view(), name="student-bulk-create"),
    path("export/", StudentExportApi.as_view(), name="student-export"),
    path("<uuid:student_id>/", StudentDetailApi.as_view(), name="student-detail"),
    path("<uuid:student_id>/history/", StudentHistoryApi.as_view(), name="student-history"),
    path("<uuid:student_id>/stats/", StudentStatsApi.as_view(), name="student-stats"),
    path("<uuid:student_id>/assign-teacher/", StudentAssignTeacherApi.as_view(), name="student-assign-teacher"),
    path("<uuid:student_id>/link-parent/", StudentLinkParentApi.as_view(), name="student-link-parent"),
    path("<uuid:student_id>/tasks/today/", StudentTasksTodayApi.as_view(), name="student-tasks-today"),
    path("<uuid:student_id>/reviews/complete/", StudentReviewCompleteApi.as_view(), name="student-review-complete"),
    path("<uuid:student_id>/review-interval/", StudentReviewIntervalApi.as_view(), name="student-review-interval"),
    path("teacher-requests/", ChangeRequestListCreateApi.as_view(), name="student-change-request-list-create"),
    path("teacher-requests/<uuid:request_id>/approve/", ChangeRequestApproveApi.as_view(), name="student-change-request-approve"),
    path("teacher-requests/<uuid:request_id>/reject/", ChangeRequestRejectApi.as_view(), name="student-change-request-reject"),
    path("teacher-requests/<uuid:request_id>/", ChangeRequestCancelApi.as_view(), name="student-change-request-cancel"),
]
