from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

from core.permissions import IsAdmin, IsAdminOrTeacher, IsAdminOrTeacherOrSelf


class MonthYearFilterSerializer(serializers.Serializer):
    month = serializers.IntegerField(min_value=1, max_value=12)
    year = serializers.IntegerField(min_value=2020, max_value=2100)
from students.selectors.student_selectors import student_get
from reports.selectors.report_selectors import (
    dashboard_data,
    attendance_report,
    leaderboard,
)
from reports.services.report_services import generate_student_pdf


class DashboardApi(APIView):
    """GET /api/reports/dashboard/ — لوحة تحكم المدير"""

    permission_classes = [IsAdmin]

    def get(self, request):
        data = dashboard_data(admin_user=request.user)
        return Response({"success": True, "data": data}, status=status.HTTP_200_OK)


class AttendanceReportApi(APIView):
    """GET /api/reports/attendance/?month=4&year=2026&teacher= — تقرير الحضور الشهري"""

    permission_classes = [IsAdminOrTeacher]

    def get(self, request):
        filter_ser = MonthYearFilterSerializer(data=request.query_params)
        filter_ser.is_valid(raise_exception=True)
        teacher_id = request.query_params.get("teacher")

        data = attendance_report(
            month=filter_ser.validated_data["month"],
            year=filter_ser.validated_data["year"],
            actor=request.user,
            teacher_id=teacher_id,
        )
        return Response({"success": True, "data": data}, status=status.HTTP_200_OK)


class StudentPDFReportApi(APIView):
    """GET /api/reports/student/<id>/pdf/ — تقرير PDF للطالب"""

    permission_classes = [IsAdminOrTeacher]

    def get(self, request, student_id):
        student = student_get(student_id=student_id, actor=request.user)
        pdf_bytes = generate_student_pdf(student_id=student.id)

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="student_report_{student_id}.pdf"'
        return response


class LeaderboardApi(APIView):
    """GET /api/reports/leaderboard/?month=4&year=2026 — لوحة الشرف"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request):
        filter_ser = MonthYearFilterSerializer(data=request.query_params)
        filter_ser.is_valid(raise_exception=True)

        data = leaderboard(
            month=filter_ser.validated_data["month"],
            year=filter_ser.validated_data["year"],
        )
        return Response({"success": True, "data": data}, status=status.HTTP_200_OK)
