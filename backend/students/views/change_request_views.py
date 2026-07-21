from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

from core.permissions import IsAdmin, IsAdminOrTeacher, IsTeacher
from students.models import StudentChangeRequest
from students.selectors.change_request_selectors import change_request_list
from students.services.change_request_services import (
    student_change_request_approve,
    student_change_request_cancel,
    student_change_request_create,
    student_change_request_reject,
)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
class ChangeRequestFilterSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=StudentChangeRequest.Status.choices, required=False)
    action = serializers.ChoiceField(choices=StudentChangeRequest.Action.choices, required=False)


class ChangeRequestCreateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=StudentChangeRequest.Action.choices)
    student_id = serializers.UUIDField(required=False, allow_null=True)
    payload = serializers.DictField(required=False, default=dict)


class ChangeRequestRejectSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ChangeRequestOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    teacher_id = serializers.UUIDField(source="teacher.id")
    teacher_name = serializers.CharField(source="teacher.full_name")
    student_id = serializers.UUIDField(source="student.id", default=None)
    student_name = serializers.SerializerMethodField()
    action = serializers.CharField()
    status = serializers.CharField()
    payload = serializers.JSONField()
    requested_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    reviewed_at = serializers.DateTimeField(default=None)
    note = serializers.CharField()
    created_at = serializers.DateTimeField()

    def get_student_name(self, obj) -> str:
        if obj.student:
            return obj.student.full_name
        return obj.payload.get("full_name", "طالب جديد")

    def get_requested_by_name(self, obj) -> str | None:
        return obj.requested_by.get_full_name() or None if obj.requested_by else None

    def get_reviewed_by_name(self, obj) -> str | None:
        return obj.reviewed_by.get_full_name() or None if obj.reviewed_by else None


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class ChangeRequestListCreateApi(APIView):
    """
    GET /api/students/teacher-requests/ — قائمة الطلبات (المدير: الكل، المحفظ: طلباته)
    POST /api/students/teacher-requests/ — تقديم طلب جديد (محفظ فقط)
    """

    permission_classes = [IsAdminOrTeacher]

    def get(self, request):
        filter_serializer = ChangeRequestFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)

        requests_qs = change_request_list(filters=filter_serializer.validated_data, user=request.user)

        return Response(
            {"success": True, "data": ChangeRequestOutputSerializer(requests_qs, many=True).data},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = ChangeRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        req = student_change_request_create(
            actor=request.user,
            action=serializer.validated_data["action"],
            student_id=serializer.validated_data.get("student_id"),
            payload=serializer.validated_data.get("payload"),
        )

        return Response(
            {"success": True, "data": ChangeRequestOutputSerializer(req).data},
            status=status.HTTP_201_CREATED,
        )


class ChangeRequestApproveSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ChangeRequestApproveApi(APIView):
    """POST /api/students/teacher-requests/<id>/approve/ — موافقة (مدير فقط)"""

    permission_classes = [IsAdmin]

    def post(self, request, request_id):
        serializer = ChangeRequestApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.validated_data.get("note", "")

        req = student_change_request_approve(actor=request.user, request_id=request_id, note=note)
        return Response(
            {"success": True, "data": ChangeRequestOutputSerializer(req).data},
            status=status.HTTP_200_OK,
        )


class ChangeRequestRejectApi(APIView):
    """POST /api/students/teacher-requests/<id>/reject/ — رفض (مدير فقط)"""

    permission_classes = [IsAdmin]

    def post(self, request, request_id):
        serializer = ChangeRequestRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        req = student_change_request_reject(
            actor=request.user,
            request_id=request_id,
            note=serializer.validated_data["note"],
        )
        return Response(
            {"success": True, "data": ChangeRequestOutputSerializer(req).data},
            status=status.HTTP_200_OK,
        )


class ChangeRequestCancelApi(APIView):
    """DELETE /api/students/teacher-requests/<id>/ — سحب طلب معلّق (المحفظ صاحب الطلب فقط)"""

    permission_classes = [IsTeacher]

    def delete(self, request, request_id):
        student_change_request_cancel(actor=request.user, request_id=request_id)
        return Response(
            {"success": True, "message": "تم سحب الطلب بنجاح."},
            status=status.HTTP_200_OK,
        )
