from django.urls import path

from students.views.student_views import (
    StudentListApi,
    StudentCreateApi,
    StudentDetailApi,
    StudentDeactivateApi,
    StudentHistoryApi,
    StudentStatsApi,
    StudentAssignTeacherApi,
    StudentLinkParentApi,
)
from students.views.ring_views import (
    RingListApi,
    RingCreateApi,
    RingDetailApi,
    TeacherAssignRingApi,
)

urlpatterns = [
    path("", StudentListApi.as_view(), name="student-list"),
    path("create/", StudentCreateApi.as_view(), name="student-create"),
    path("<uuid:student_id>/", StudentDetailApi.as_view(), name="student-detail"),
    path("<uuid:student_id>/delete/", StudentDeactivateApi.as_view(), name="student-deactivate"),
    path("<uuid:student_id>/history/", StudentHistoryApi.as_view(), name="student-history"),
    path("<uuid:student_id>/stats/", StudentStatsApi.as_view(), name="student-stats"),
    path("<uuid:student_id>/assign-teacher/", StudentAssignTeacherApi.as_view(), name="student-assign-teacher"),
    path("<uuid:student_id>/link-parent/", StudentLinkParentApi.as_view(), name="student-link-parent"),
    
    # Ring endpoints
    path("rings/", RingListApi.as_view(), name="ring-list"),
    path("rings/create/", RingCreateApi.as_view(), name="ring-create"),
    path("rings/<uuid:ring_id>/", RingDetailApi.as_view(), name="ring-detail"),
    path("teachers/<uuid:teacher_id>/assign-ring/", TeacherAssignRingApi.as_view(), name="teacher-assign-ring"),
]
