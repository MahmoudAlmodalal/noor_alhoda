from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

from core.permissions import IsAdmin, IsAdminOrTeacher, IsAdminOrTeacherOrSelf
from students.selectors.student_selectors import (
    student_list,
    student_get,
    student_history,
    student_stats,
)
from students.services.student_services import (
    student_create,
    student_update,
    student_deactivate,
    student_assign_teacher,
    student_link_parent,
)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
class StudentFilterSerializer(serializers.Serializer):
    teacher_id = serializers.UUIDField(required=False)
    grade = serializers.CharField(required=False)
    search = serializers.CharField(required=False)


class StudentInputSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    full_name = serializers.CharField()
    national_id = serializers.CharField()
    birthdate = serializers.DateField()
    grade = serializers.CharField()
    address = serializers.CharField(required=False, default="")
    whatsapp = serializers.CharField(required=False, default="")
    teacher_id = serializers.UUIDField(required=False)
    health_status = serializers.CharField(required=False, default="normal")
    health_note = serializers.CharField(required=False, default="")
    skills = serializers.JSONField(required=False, default=dict)
    password = serializers.CharField(required=False, default="nooralhuda2026")


class StudentOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    national_id = serializers.CharField()
    birthdate = serializers.DateField()
    grade = serializers.CharField()
    address = serializers.CharField()
    whatsapp = serializers.CharField()
    teacher_id = serializers.UUIDField(source="teacher.id", default=None)
    teacher_name = serializers.CharField(source="teacher.full_name", default=None)
    health_status = serializers.CharField()
    health_note = serializers.CharField()
    skills = serializers.JSONField()
    is_active = serializers.BooleanField()
    enrollment_date = serializers.DateField()


class StudentUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(required=False)
    national_id = serializers.CharField(required=False)
    birthdate = serializers.DateField(required=False)
    grade = serializers.CharField(required=False)
    address = serializers.CharField(required=False)
    whatsapp = serializers.CharField(required=False)
    health_status = serializers.CharField(required=False)
    health_note = serializers.CharField(required=False)
    skills = serializers.JSONField(required=False)


class AssignTeacherSerializer(serializers.Serializer):
    teacher_id = serializers.UUIDField()


class LinkParentSerializer(serializers.Serializer):
    parent_id = serializers.UUIDField()


class WeeklyPlanOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    week_number = serializers.IntegerField()
    week_start = serializers.DateField()
    total_required = serializers.IntegerField()
    total_achieved = serializers.IntegerField()
    completion_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    created_at = serializers.DateTimeField()


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class StudentListApi(APIView):
    """GET /api/students/ — قائمة الطلاب مع البحث والفلترة"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request):
        filter_serializer = StudentFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)

        students = student_list(
            filters=filter_serializer.validated_data,
            user=request.user,
        )

        return Response(
            {"success": True, "data": StudentOutputSerializer(students, many=True).data},
            status=status.HTTP_200_OK,
        )


class StudentCreateApi(APIView):
    """POST /api/students/ — إنشاء طالب جديد"""

    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = StudentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student = student_create(creator=request.user, **serializer.validated_data)

        return Response(
            {"success": True, "data": StudentOutputSerializer(student).data},
            status=status.HTTP_201_CREATED,
        )


class StudentDetailApi(APIView):
    """
    GET /api/students/<id>/ — بيانات طالب واحد
    PATCH /api/students/<id>/ — تعديل بيانات الطالب
    """

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request, student_id):
        student = student_get(student_id=student_id, actor=request.user)
        return Response(
            {"success": True, "data": StudentOutputSerializer(student).data},
            status=status.HTTP_200_OK,
        )

    def patch(self, request, student_id):
        student = student_get(student_id=student_id, actor=request.user)
        serializer = StudentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = student_update(
            student=student,
            actor=request.user,
            data=serializer.validated_data,
        )

        return Response(
            {"success": True, "data": StudentOutputSerializer(updated).data},
            status=status.HTTP_200_OK,
        )


class StudentDeactivateApi(APIView):
    """DELETE /api/students/<id>/ — إلغاء تسجيل (soft delete)"""

    permission_classes = [IsAdmin]

    def delete(self, request, student_id):
        student_deactivate(student_id=student_id, actor=request.user)
        return Response(
            {"success": True, "message": "تم إيقاف تسجيل الطالب بنجاح."},
            status=status.HTTP_200_OK,
        )


class StudentHistoryApi(APIView):
    """GET /api/students/<id>/history/ — السجل الحفظي الكامل"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request, student_id):
        history = student_history(student_id=student_id, actor=request.user)
        return Response(
            {"success": True, "data": WeeklyPlanOutputSerializer(history, many=True).data},
            status=status.HTTP_200_OK,
        )


class StudentStatsApi(APIView):
    """GET /api/students/<id>/stats/ — إحصائيات الطالب"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request, student_id):
        stats = student_stats(student_id=student_id, actor=request.user)
        return Response(
            {"success": True, "data": stats},
            status=status.HTTP_200_OK,
        )


class StudentAssignTeacherApi(APIView):
    """PATCH /api/students/<id>/assign-teacher/ — تعيين محفظ"""

    permission_classes = [IsAdmin]

    def patch(self, request, student_id):
        serializer = AssignTeacherSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student = student_assign_teacher(
            student_id=student_id,
            teacher_id=serializer.validated_data["teacher_id"],
            actor=request.user,
        )

        return Response(
            {"success": True, "data": StudentOutputSerializer(student).data},
            status=status.HTTP_200_OK,
        )


class StudentLinkParentApi(APIView):
    """POST /api/students/<id>/link-parent/ — ربط ولي الأمر"""

    permission_classes = [IsAdmin]

    def post(self, request, student_id):
        serializer = LinkParentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student_link_parent(
            student_id=student_id,
            parent_id=serializer.validated_data["parent_id"],
            actor=request.user,
        )

        return Response(
            {"success": True, "message": "تم ربط ولي الأمر بالطالب بنجاح."},
            status=status.HTTP_201_CREATED,
        )
