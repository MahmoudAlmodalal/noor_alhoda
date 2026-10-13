from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from core.permissions import IsAdmin
from reports.services.analytics import teacher_dataset


class AnalyticsFilterSerializer(serializers.Serializer):
    period = serializers.ChoiceField(
        choices=["all", "week", "month", "quarter", "year", "custom"], default="all"
    )
    from_date = serializers.DateField(required=False)
    to_date = serializers.DateField(required=False)
    group_by = serializers.ChoiceField(choices=["week", "month"], default="month")
    q = serializers.CharField(required=False, allow_blank=True, max_length=100)
    status = serializers.ChoiceField(
        choices=["all", "active", "inactive"], default="all"
    )
    sort = serializers.ChoiceField(
        choices=["name", "memorization", "revision"], default="name"
    )
    page = serializers.IntegerField(min_value=1, default=1)
    page_size = serializers.IntegerField(min_value=1, max_value=100, default=20)

    def validate(self, values):
        today = timezone.localdate()
        period = values["period"]
        if period == "custom":
            if not values.get("from_date") or not values.get("to_date"):
                raise serializers.ValidationError("حدد بداية ونهاية الفترة المخصصة.")
            first, last = values["from_date"], values["to_date"]
        else:
            last = today
            first = None
            if period == "week":
                first = today - timedelta(days=(today.weekday() + 2) % 7)
            elif period == "month":
                first = today.replace(day=1)
            elif period == "quarter":
                # Current month plus two preceding calendar months.
                anchor = today.year * 12 + today.month - 3
                first = today.replace(year=anchor // 12, month=anchor % 12 + 1, day=1)
            elif period == "year":
                first = today.replace(month=1, day=1)
        if first and first > last:
            raise serializers.ValidationError("بداية الفترة يجب أن تسبق نهايتها.")
        values.update({"from": first, "to": last})
        return values


def analytics_filters(request):
    data = request.query_params.copy()
    if data.get("from"):
        data["from_date"] = data["from"]
    if data.get("to"):
        data["to_date"] = data["to"]
    serializer = AnalyticsFilterSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


class TeacherAnalyticsApi(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(
        parameters=[
            AnalyticsFilterSerializer,
            OpenApiParameter("from", OpenApiTypes.DATE),
            OpenApiParameter("to", OpenApiTypes.DATE),
        ],
        responses={200: OpenApiTypes.OBJECT},
        description="Read-only current-roster analytics; see docs/teacher-student-analytics.md for units and calculation rules.",
        tags=["Analytics"],
    )
    def get(self, request, teacher_id):
        filters = analytics_filters(request)
        data = teacher_dataset(teacher_id, filters)
        rows = data["students"]
        data["comparison"] = [
            {
                "id": r["student"]["id"],
                "name": r["student"]["name"],
                "memorization": r["memorization_goal"],
                "revision": r["revision"],
                "attendance": r["attendance"]["percentage"],
                "exam": r["exams"]["average"],
            }
            for r in rows
        ]
        start = (filters["page"] - 1) * filters["page_size"]
        data["students"] = rows[start : start + filters["page_size"]]
        data["pagination"] = {
            "page": filters["page"],
            "page_size": filters["page_size"],
            "total": len(rows),
            "pages": max(
                1, (len(rows) + filters["page_size"] - 1) // filters["page_size"]
            ),
        }
        response = Response({"success": True, "data": data})
        response["Cache-Control"] = "private, no-store"
        return response


class StudentAnalyticsApi(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(
        parameters=[
            AnalyticsFilterSerializer,
            OpenApiParameter("from", OpenApiTypes.DATE),
            OpenApiParameter("to", OpenApiTypes.DATE),
        ],
        responses={200: OpenApiTypes.OBJECT},
        description="Detailed achievement history for a student in this teacher's current roster.",
        tags=["Analytics"],
    )
    def get(self, request, teacher_id, student_id):
        data = teacher_dataset(
            teacher_id, analytics_filters(request), detailed=True, student_id=student_id
        )
        response = Response(
            {
                "success": True,
                "data": {
                    "teacher": data["teacher"],
                    "period": data["period"],
                    "methods": data["methods"],
                    **data["students"][0],
                },
            }
        )
        response["Cache-Control"] = "private, no-store"
        return response


class AnalyticsPDFApi(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(
        parameters=[
            AnalyticsFilterSerializer,
            OpenApiParameter("from", OpenApiTypes.DATE),
            OpenApiParameter("to", OpenApiTypes.DATE),
            OpenApiParameter("print", OpenApiTypes.BOOL),
        ],
        responses={(200, "application/pdf"): OpenApiTypes.BINARY},
        description="Complete Arabic A4 report using the same filters and calculations as the dashboard, without pagination limits.",
        tags=["Analytics"],
    )
    def get(self, request, teacher_id, student_id=None):
        from reports.services.analytics_pdf import generate_analytics_pdf

        data = teacher_dataset(
            teacher_id, analytics_filters(request), detailed=True, student_id=student_id
        )
        pdf = generate_analytics_pdf(data, individual=bool(student_id))
        response = HttpResponse(pdf, content_type="application/pdf")
        mode = "inline" if request.query_params.get("print") == "1" else "attachment"
        name = f"student-{student_id}" if student_id else f"teacher-{teacher_id}"
        response["Content-Disposition"] = f'{mode}; filename="{name}-analytics.pdf"'
        response["Cache-Control"] = "private, no-store"
        return response
