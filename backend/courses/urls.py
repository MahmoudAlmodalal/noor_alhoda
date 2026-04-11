from django.urls import path

from courses.views.course_views import (
    CourseCreateApi,
    CourseDetailApi,
    CourseListApi,
    StudentCourseToggleApi,
    StudentCoursesApi,
)

urlpatterns = [
    path("", CourseListApi.as_view(), name="course-list"),
    path("create/", CourseCreateApi.as_view(), name="course-create"),
    path("<uuid:course_id>/", CourseDetailApi.as_view(), name="course-detail"),
    path(
        "students/<uuid:student_id>/",
        StudentCoursesApi.as_view(),
        name="student-courses",
    ),
    path(
        "students/<uuid:student_id>/toggle/",
        StudentCourseToggleApi.as_view(),
        name="student-course-toggle",
    ),
]
