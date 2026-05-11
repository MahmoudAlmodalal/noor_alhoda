from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

from core.permissions import IsAdminOrTeacher, IsAdminOrTeacherOrSelf
from progress.constants import SURAHS
from progress.selectors.progress_selectors import progress_get, progress_list
from progress.services.progress_services import (
    progress_create,
    progress_delete,
    progress_update,
)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
class ProgressOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    student_id = serializers.UUIDField()
    student_name = serializers.CharField(source="student.full_name")
    teacher_id = serializers.UUIDField(allow_null=True)
    teacher_name = serializers.CharField(
        source="teacher.full_name", allow_null=True, default=None
    )
    surah_number = serializers.IntegerField()
    surah_name = serializers.CharField()
    juz_number = serializers.IntegerField()
    from_page = serializers.IntegerField(allow_null=True)
    to_page = serializers.IntegerField(allow_null=True)
    note = serializers.CharField(allow_blank=True)
    recorded_at = serializers.DateTimeField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class ProgressInputSerializer(serializers.Serializer):
    student_id = serializers.UUIDField()
    surah_number = serializers.IntegerField(min_value=1, max_value=114)
    juz_number = serializers.IntegerField(min_value=1, max_value=30)
    from_page = serializers.IntegerField(required=False, allow_null=True, default=None)
    to_page = serializers.IntegerField(required=False, allow_null=True, default=None)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ProgressUpdateSerializer(serializers.Serializer):
    surah_number = serializers.IntegerField(
        min_value=1, max_value=114, required=False
    )
    juz_number = serializers.IntegerField(
        min_value=1, max_value=30, required=False
    )
    from_page = serializers.IntegerField(required=False, allow_null=True)
    to_page = serializers.IntegerField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True)


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class ProgressListApi(APIView):
    """GET /api/progress/?student=<uuid> — سجل تقدم الحفظ لطالب"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request):
        student_id = request.query_params.get("student")
        if not student_id:
            return Response(
                {"success": False, "error": "يجب تحديد معرّف الطالب (student=<uuid>)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entries = progress_list(student_id=student_id, actor=request.user)

        return Response(
            {
                "success": True,
                "data": ProgressOutputSerializer(entries, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class ProgressCreateApi(APIView):
    """POST /api/progress/ — إضافة سجل تقدم جديد"""

    permission_classes = [IsAdminOrTeacher]

    def post(self, request):
        serializer = ProgressInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entry = progress_create(actor=request.user, **serializer.validated_data)

        return Response(
            {"success": True, "data": ProgressOutputSerializer(entry).data},
            status=status.HTTP_201_CREATED,
        )


class ProgressUpdateApi(APIView):
    """PATCH /api/progress/<id>/ — تعديل سجل تقدم"""

    permission_classes = [IsAdminOrTeacher]

    def patch(self, request, progress_id):
        serializer = ProgressUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entry = progress_get(progress_id=progress_id, actor=request.user)
        updated = progress_update(
            progress=entry, actor=request.user, data=serializer.validated_data
        )

        return Response(
            {"success": True, "data": ProgressOutputSerializer(updated).data},
            status=status.HTTP_200_OK,
        )


class ProgressDeleteApi(APIView):
    """DELETE /api/progress/<id>/ — حذف سجل تقدم"""

    permission_classes = [IsAdminOrTeacher]

    def delete(self, request, progress_id):
        entry = progress_get(progress_id=progress_id, actor=request.user)
        progress_delete(progress=entry, actor=request.user)

        return Response(
            {"success": True, "data": {"id": str(progress_id)}},
            status=status.HTTP_200_OK,
        )


class SurahListApi(APIView):
    """GET /api/progress/surahs/ — قائمة السور القرآنية"""

    # Any authenticated user can see the surah list
    def get(self, request):
        return Response(
            {"success": True, "data": SURAHS},
            status=status.HTTP_200_OK,
        )
