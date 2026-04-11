from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin, IsAdminOrTeacherOrSelf
from courses.selectors.course_selectors import (
    course_get,
    course_list,
    student_courses_list,
)
from courses.services.course_services import (
    course_create,
    course_delete,
    course_update,
    student_course_set_status,
)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
class CourseInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    description = serializers.CharField(required=False, allow_blank=True, default="")


class CourseUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, required=False)
    description = serializers.CharField(required=False, allow_blank=True)


class CourseOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class StudentCourseStatusSerializer(serializers.Serializer):
    course_id = serializers.CharField()
    course_name = serializers.CharField()
    description = serializers.CharField()
    is_completed = serializers.BooleanField()
    completion_date = serializers.DateField(allow_null=True)


class StudentCourseToggleSerializer(serializers.Serializer):
    course_id = serializers.UUIDField()
    is_completed = serializers.BooleanField()


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class CourseListApi(APIView):
    """GET /api/courses/ — قائمة الدورات"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        courses = course_list(user=request.user)
        return Response(
            {"success": True, "data": CourseOutputSerializer(courses, many=True).data},
            status=status.HTTP_200_OK,
        )


class CourseCreateApi(APIView):
    """POST /api/courses/create/ — إنشاء دورة (Admin)"""

    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = CourseInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        course = course_create(actor=request.user, **serializer.validated_data)
        return Response(
            {"success": True, "data": CourseOutputSerializer(course).data},
            status=status.HTTP_201_CREATED,
        )


class CourseDetailApi(APIView):
    """
    GET /api/courses/<id>/ — تفاصيل دورة
    PATCH /api/courses/<id>/ — تعديل دورة (Admin)
    DELETE /api/courses/<id>/ — حذف دورة (Admin)
    """

    def get_permissions(self):
        if self.request.method in ("PATCH", "DELETE"):
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get(self, request, course_id):
        course = course_get(course_id=course_id)
        return Response(
            {"success": True, "data": CourseOutputSerializer(course).data},
            status=status.HTTP_200_OK,
        )

    def patch(self, request, course_id):
        serializer = CourseUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = course_update(
            actor=request.user,
            course_id=course_id,
            data=serializer.validated_data,
        )
        return Response(
            {"success": True, "data": CourseOutputSerializer(updated).data},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, course_id):
        course_delete(actor=request.user, course_id=course_id)
        return Response(
            {"success": True, "message": "تم حذف الدورة بنجاح."},
            status=status.HTTP_200_OK,
        )


class StudentCoursesApi(APIView):
    """GET /api/courses/students/<student_id>/ — قائمة الدورات مع حالتها لطالب معيّن"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request, student_id):
        data = student_courses_list(student_id=student_id, actor=request.user)
        return Response(
            {"success": True, "data": StudentCourseStatusSerializer(data, many=True).data},
            status=status.HTTP_200_OK,
        )


class StudentCourseToggleApi(APIView):
    """POST /api/courses/students/<student_id>/toggle/ — تعيين حالة دورة لطالب (Admin)"""

    permission_classes = [IsAdmin]

    def post(self, request, student_id):
        serializer = StudentCourseToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student_course_set_status(
            actor=request.user,
            student_id=student_id,
            course_id=serializer.validated_data["course_id"],
            is_completed=serializer.validated_data["is_completed"],
        )
        return Response(
            {"success": True, "message": "تم تحديث حالة الدورة بنجاح."},
            status=status.HTTP_200_OK,
        )
