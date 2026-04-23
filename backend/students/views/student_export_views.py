"""
Excel export view for the students list.

Returns an xlsx attachment — not a JSON envelope — which matches the
precedent set by ``/api/reports/student/<id>/pdf/``. The selector layer
enforces row-level RBAC, so an admin gets all students and a teacher
gets only their own.
"""
from datetime import date

from django.http import HttpResponse
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminOrTeacher
from students.selectors.student_selectors import student_list
from students.services.export_services import generate_students_xlsx


# ---------------------------------------------------------------------------
# Serializer
# ---------------------------------------------------------------------------
class _ExportFilterSerializer(serializers.Serializer):
    teacher_id = serializers.UUIDField(required=False)
    course_id = serializers.UUIDField(required=False)
    grade = serializers.CharField(required=False)
    search = serializers.CharField(required=False)


# ---------------------------------------------------------------------------
# View
# ---------------------------------------------------------------------------
class StudentExportApi(APIView):
    """GET /api/students/export/ — تصدير قائمة الطلاب إلى ملف Excel."""

    permission_classes = [IsAuthenticated, IsAdminOrTeacher]

    def get(self, request):
        filter_serializer = _ExportFilterSerializer(data=request.query_params)
        if not filter_serializer.is_valid():
            return Response(
                {"success": False, "errors": filter_serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        students = student_list(
            filters=filter_serializer.validated_data,
            user=request.user,
        )

        content = generate_students_xlsx(students)

        filename = f"students-{date.today():%Y-%m-%d}.xlsx"
        response = HttpResponse(
            content,
            content_type=(
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
