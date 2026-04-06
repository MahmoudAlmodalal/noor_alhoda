from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

from backend.core.permissions import IsAdminOrTeacher, IsAdminOrTeacherOrSelf
from backend.records.selectors.record_selectors import daily_records_by_date, weekly_summary
from backend.records.services.record_services import (
    daily_record_create,
    daily_record_update,
    bulk_attendance_create,
    weekly_plan_create,
)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
class DailyRecordOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    day = serializers.CharField()
    date = serializers.DateField()
    attendance = serializers.CharField()
    required_verses = serializers.IntegerField()
    achieved_verses = serializers.IntegerField()
    surah_name = serializers.CharField()
    quality = serializers.CharField()
    result = serializers.CharField()
    note = serializers.CharField()
    student_name = serializers.CharField(source="weekly_plan.student.full_name")
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class DailyRecordInputSerializer(serializers.Serializer):
    weekly_plan_id = serializers.UUIDField()
    day = serializers.ChoiceField(choices=["sat", "sun", "mon", "tue", "wed", "thu"])
    date = serializers.DateField()
    attendance = serializers.ChoiceField(
        choices=["present", "absent", "late", "excused"],
        default="present",
    )
    required_verses = serializers.IntegerField(default=0)
    achieved_verses = serializers.IntegerField(default=0)
    surah_name = serializers.CharField(required=False, default="")
    quality = serializers.ChoiceField(
        choices=["excellent", "good", "acceptable", "weak", "none"],
        default="none",
    )
    result = serializers.ChoiceField(
        choices=["pass", "fail", "pending"],
        default="pending",
        required=False,
    )
    note = serializers.CharField(required=False, default="")


class DailyRecordUpdateSerializer(serializers.Serializer):
    attendance = serializers.ChoiceField(
        choices=["present", "absent", "late", "excused"],
        required=False,
    )
    required_verses = serializers.IntegerField(required=False)
    achieved_verses = serializers.IntegerField(required=False)
    surah_name = serializers.CharField(required=False)
    quality = serializers.ChoiceField(
        choices=["excellent", "good", "acceptable", "weak", "none"],
        required=False,
    )
    result = serializers.ChoiceField(
        choices=["pass", "fail", "pending"],
        required=False,
    )
    note = serializers.CharField(required=False)


class BulkAttendanceItemSerializer(serializers.Serializer):
    student_id = serializers.UUIDField()
    attendance = serializers.ChoiceField(
        choices=["present", "absent", "late", "excused"],
        default="present",
    )


class BulkAttendanceInputSerializer(serializers.Serializer):
    date = serializers.DateField()
    records = BulkAttendanceItemSerializer(many=True)


class WeeklyPlanInputSerializer(serializers.Serializer):
    student_id = serializers.UUIDField()
    week_start = serializers.DateField()
    week_number = serializers.IntegerField()


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class DailyRecordListApi(APIView):
    """GET /api/records/?date=YYYY-MM-DD — سجلات يوم محدد"""

    permission_classes = [IsAdminOrTeacher]

    def get(self, request):
        date = request.query_params.get("date")
        if not date:
            return Response(
                {"success": False, "error": "يجب تحديد التاريخ (date=YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        records = daily_records_by_date(teacher_user=request.user, date=date)

        return Response(
            {"success": True, "data": DailyRecordOutputSerializer(records, many=True).data},
            status=status.HTTP_200_OK,
        )


class DailyRecordCreateApi(APIView):
    """POST /api/records/ — إنشاء سجل يومي"""

    permission_classes = [IsAdminOrTeacher]

    def post(self, request):
        serializer = DailyRecordInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        record = daily_record_create(teacher=request.user, **serializer.validated_data)

        return Response(
            {"success": True, "data": DailyRecordOutputSerializer(record).data},
            status=status.HTTP_201_CREATED,
        )


class DailyRecordUpdateApi(APIView):
    """PATCH /api/records/<id>/ — تعديل سجل يومي"""

    permission_classes = [IsAdminOrTeacher]

    def patch(self, request, record_id):
        serializer = DailyRecordUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        record = daily_record_update(
            record_id=record_id,
            teacher=request.user,
            data=serializer.validated_data,
        )

        return Response(
            {"success": True, "data": DailyRecordOutputSerializer(record).data},
            status=status.HTTP_200_OK,
        )


class BulkAttendanceApi(APIView):
    """POST /api/records/bulk-attendance/ — تسجيل حضور كل الطلاب دفعة واحدة"""

    permission_classes = [IsAdminOrTeacher]

    def post(self, request):
        serializer = BulkAttendanceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        records = bulk_attendance_create(
            teacher=request.user,
            date=serializer.validated_data["date"],
            attendance_data=serializer.validated_data["records"],
        )

        return Response(
            {
                "success": True,
                "message": f"تم تسجيل حضور {len(records)} طالب.",
                "count": len(records),
            },
            status=status.HTTP_201_CREATED,
        )


class WeeklySummaryApi(APIView):
    """GET /api/records/weekly-summary/<student_id>/?week_start=YYYY-MM-DD"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request, student_id):
        week_start = request.query_params.get("week_start")
        if not week_start:
            return Response(
                {"success": False, "error": "يجب تحديد بداية الأسبوع (week_start=YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = weekly_summary(
            student_id=student_id,
            week_start=week_start,
            actor=request.user,
        )

        return Response({"success": True, "data": data}, status=status.HTTP_200_OK)


class WeeklyPlanCreateApi(APIView):
    """POST /api/records/weekly-plans/ — إنشاء خطة أسبوعية"""

    permission_classes = [IsAdminOrTeacher]

    def post(self, request):
        serializer = WeeklyPlanInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        plan = weekly_plan_create(
            student_id=serializer.validated_data["student_id"],
            week_start=serializer.validated_data["week_start"],
            week_number=serializer.validated_data["week_number"],
            teacher=request.user,
        )

        return Response(
            {
                "success": True,
                "data": {
                    "id": str(plan.id),
                    "student": plan.student.full_name,
                    "week_number": plan.week_number,
                    "week_start": str(plan.week_start),
                },
            },
            status=status.HTTP_201_CREATED,
        )
