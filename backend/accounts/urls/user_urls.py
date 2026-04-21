from django.urls import path

from accounts.views.user_views import (
    UserListApi,
    UserCreateApi,
    UserDetailApi,
)
from teacher.views.teacher_views import TeacherListApi, TeacherCreateApi

urlpatterns = [
    path("", UserListApi.as_view(), name="user-list"),
    path("create/", UserCreateApi.as_view(), name="user-create"),
    path("<uuid:user_id>/", UserDetailApi.as_view(), name="user-detail"),
    path("teachers/", TeacherListApi.as_view(), name="teacher-list"),
    path("teachers/create/", TeacherCreateApi.as_view(), name="teacher-create"),
]
