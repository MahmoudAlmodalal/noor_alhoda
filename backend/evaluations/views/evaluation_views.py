from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminOrTeacher, IsAdminOrTeacherOrSelf
from evaluations.models import Evaluation
from evaluations.services.evaluation_services import evaluation_create, evaluation_update
from students.selectors.student_selectors import can_access_student


class EvaluationOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    student_id = serializers.UUIDField()
    student_name = serializers.CharField(source="student.full_name")
    title = serializers.CharField()
    surah_range = serializers.CharField()
    scheduled_date = serializers.DateField()
    status = serializers.CharField()
    result_note = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class EvaluationCreateSerializer(serializers.Serializer):
    student_id = serializers.UUIDField()
    title = serializers.CharField(max_length=200)
    surah_range = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    scheduled_date = serializers.DateField()


class EvaluationUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False)
    surah_range = serializers.CharField(max_length=200, required=False, allow_blank=True)
    scheduled_date = serializers.DateField(required=False)
    status = serializers.ChoiceField(
        choices=["scheduled", "passed", "failed", "missed"],
        required=False,
    )
    result_note = serializers.CharField(required=False, allow_blank=True)


class EvaluationListCreateApi(APIView):
    """
    GET  /api/evaluations/?student_id=<uuid>  — list evaluations for a student
    POST /api/evaluations/                    — create evaluation
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdminOrTeacher()]
        return [IsAdminOrTeacherOrSelf()]

    def get(self, request):
        student_id = request.query_params.get("student_id")
        if not student_id:
            return Response(
                {"success": False, "error": "يجب تحديد الطالب (student_id)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from students.selectors.student_selectors import student_get
        student = student_get(student_id=student_id, actor=request.user)
        # student_get already enforces can_access_student

        evaluations = Evaluation.objects.select_related("student").filter(
            student=student
        ).order_by("scheduled_date")

        return Response(
            {"success": True, "data": EvaluationOutputSerializer(evaluations, many=True).data},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = EvaluationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ev = evaluation_create(
            student_id=serializer.validated_data["student_id"],
            title=serializer.validated_data["title"],
            surah_range=serializer.validated_data.get("surah_range", ""),
            scheduled_date=serializer.validated_data["scheduled_date"],
            actor=request.user,
        )
        return Response(
            {"success": True, "data": EvaluationOutputSerializer(ev).data},
            status=status.HTTP_201_CREATED,
        )


class EvaluationDetailApi(APIView):
    """PATCH /api/evaluations/<id>/ — update evaluation"""

    permission_classes = [IsAdminOrTeacher]

    def patch(self, request, evaluation_id):
        serializer = EvaluationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ev = evaluation_update(
            evaluation_id=evaluation_id,
            data=serializer.validated_data,
            actor=request.user,
        )
        return Response(
            {"success": True, "data": EvaluationOutputSerializer(ev).data},
            status=status.HTTP_200_OK,
        )
