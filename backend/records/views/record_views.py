from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

from core.permissions import IsAdminOrTeacher, IsAdminOrTeacherOrSelf
from records.selectors.record_selectors import daily_records_by_date, weekly_plans_list, weekly_summary
from records.services.record_services import (
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
    student_id = serializers.UUIDField()
    student_name = serializers.CharField(source="student.full_name")
    weekly_plan_id = serializers.UUIDField(allow_null=True, required=False)
    day = serializers.CharField()
    date = serializers.DateField()
    attendance = serializers.CharField()
    required_verses = serializers.IntegerField()
    achieved_verses = serializers.IntegerField()
    from_ayah = serializers.IntegerField(allow_null=True)
    to_ayah = serializers.IntegerField(allow_null=True)
    from_page = serializers.IntegerField(allow_null=True)
    to_page = serializers.IntegerField(allow_null=True)
    memorized_lines = serializers.IntegerField()
    surah_name = serializers.CharField()
    quality = serializers.CharField()
    review_surah_name = serializers.CharField()
    review_from_ayah = serializers.IntegerField(allow_null=True)
    review_to_ayah = serializers.IntegerField(allow_null=True)
    review_quality = serializers.CharField()
    next_memorization_target = serializers.CharField(required=False, allow_blank=True, default="")
    next_memorization_from_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    next_memorization_to_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    next_review_target = serializers.CharField(required=False, allow_blank=True, default="")
    next_review_from_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    next_review_to_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    result = serializers.CharField()
    note = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class DailyRecordInputSerializer(serializers.Serializer):
    student_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    weekly_plan_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    day = serializers.ChoiceField(choices=["sat", "sun", "mon", "tue", "wed", "thu"], required=False, default="sat")
    date = serializers.DateField()
    attendance = serializers.ChoiceField(
        choices=["present", "absent", "late", "excused"],
        default="present",
    )
    required_verses = serializers.IntegerField(default=0)
    achieved_verses = serializers.IntegerField(default=0)
    from_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    to_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    from_page = serializers.IntegerField(required=False, allow_null=True, default=None)
    to_page = serializers.IntegerField(required=False, allow_null=True, default=None)
    memorized_lines = serializers.IntegerField(required=False, default=0)
    surah_name = serializers.CharField(required=False, default="")
    quality = serializers.ChoiceField(
        choices=["excellent", "good", "acceptable", "weak", "none"],
        default="none",
    )
    review_surah_name = serializers.CharField(required=False, default="")
    review_from_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    review_to_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    review_quality = serializers.ChoiceField(
        choices=["excellent", "good", "acceptable", "weak", "none"],
        default="none",
    )
    next_memorization_target = serializers.CharField(required=False, allow_blank=True, default="")
    next_memorization_from_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    next_memorization_to_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    next_review_target = serializers.CharField(required=False, allow_blank=True, default="")
    next_review_from_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
    next_review_to_ayah = serializers.IntegerField(required=False, allow_null=True, default=None)
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
    from_ayah = serializers.IntegerField(required=False, allow_null=True)
    to_ayah = serializers.IntegerField(required=False, allow_null=True)
    memorized_lines = serializers.IntegerField(required=False)
    surah_name = serializers.CharField(required=False)
    quality = serializers.ChoiceField(
        choices=["excellent", "good", "acceptable", "weak", "none"],
        required=False,
    )
    review_surah_name = serializers.CharField(required=False)
    review_from_ayah = serializers.IntegerField(required=False, allow_null=True)
    review_to_ayah = serializers.IntegerField(required=False, allow_null=True)
    review_quality = serializers.ChoiceField(
        choices=["excellent", "good", "acceptable", "weak", "none"],
        required=False,
    )
    next_memorization_target = serializers.CharField(required=False, allow_blank=True)
    next_memorization_from_ayah = serializers.IntegerField(required=False, allow_null=True)
    next_memorization_to_ayah = serializers.IntegerField(required=False, allow_null=True)
    next_review_target = serializers.CharField(required=False, allow_blank=True)
    next_review_from_ayah = serializers.IntegerField(required=False, allow_null=True)
    next_review_to_ayah = serializers.IntegerField(required=False, allow_null=True)
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
    week_number = serializers.IntegerField(required=False)
    required_pages = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, default=0)
    review_required_pages = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, default=0)
    total_required = serializers.IntegerField(required=False, default=0)
    total_required_lines = serializers.IntegerField(required=False, default=0)


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

        result = bulk_attendance_create(
            teacher=request.user,
            date=serializer.validated_data["date"],
            attendance_data=serializer.validated_data["records"],
        )

        return Response(
            {
                "success": True,
                "data": {
                    "records": [
                        {"student_id": str(r.student_id), "id": str(r.id)}
                        for r in result["records"]
                    ],
                    "skipped": result["skipped"],
                },
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
    """GET/POST /api/records/weekly-plans/ — عرض وإنشاء الخطط الأسبوعية"""

    permission_classes = [IsAdminOrTeacher]

    def get(self, request):
        week_start = request.query_params.get("week_start")
        plans = weekly_plans_list(actor=request.user, week_start=week_start)
        return Response({"success": True, "data": plans}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = WeeklyPlanInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        plan = weekly_plan_create(
            student_id=serializer.validated_data["student_id"],
            week_start=serializer.validated_data["week_start"],
            week_number=serializer.validated_data.get("week_number"),
            required_pages=serializer.validated_data.get("required_pages", 0),
            review_required_pages=serializer.validated_data.get("review_required_pages", 0),
            total_required=serializer.validated_data.get("total_required", 0),
            total_required_lines=serializer.validated_data.get("total_required_lines", 0),
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
                    "required_pages": float(plan.required_pages or 0),
                    "review_required_pages": float(plan.review_required_pages or 0),
                    "total_required": plan.total_required,
                    "total_required_lines": plan.total_required_lines,
                },
            },
            status=status.HTTP_201_CREATED,
        )
