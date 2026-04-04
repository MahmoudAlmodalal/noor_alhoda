from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from core.permissions import IsAdmin, IsAdminOrTeacher, IsAdminOrTeacherOrSelf
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
        month = request.query_params.get("month")
        year = request.query_params.get("year")
        teacher_id = request.query_params.get("teacher")

        if not month or not year:
            return Response(
                {"success": False, "error": "يجب تحديد الشهر (month) والسنة (year)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = attendance_report(
            month=int(month),
            year=int(year),
            teacher_id=teacher_id,
        )
        return Response({"success": True, "data": data}, status=status.HTTP_200_OK)


class StudentPDFReportApi(APIView):
    """GET /api/reports/student/<id>/pdf/ — تقرير PDF للطالب"""

    permission_classes = [IsAdminOrTeacher]

    def get(self, request, student_id):
        pdf_bytes = generate_student_pdf(student_id=student_id)

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="student_report_{student_id}.pdf"'
        return response


class LeaderboardApi(APIView):
    """GET /api/reports/leaderboard/?month=4&year=2026 — لوحة الشرف"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request):
        month = request.query_params.get("month")
        year = request.query_params.get("year")

        if not month or not year:
            return Response(
                {"success": False, "error": "يجب تحديد الشهر (month) والسنة (year)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = leaderboard(month=int(month), year=int(year))
        return Response({"success": True, "data": data}, status=status.HTTP_200_OK)
