from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from sync.services.push_services import sync_push


class PushOpSerializer(serializers.Serializer):
    client_id = serializers.UUIDField()
    resource = serializers.ChoiceField(choices=[
        "student",
        "teacher",
        "parent",
        "parent_student_link",
        "weekly_plan",
        "daily_record",
        "review_record",
        "evaluation",
        "course",
        "student_course",
        "notification",
    ])
    op = serializers.ChoiceField(choices=["create", "update", "delete"])
    id = serializers.UUIDField()
    data = serializers.DictField(required=False, allow_null=True, default=dict)
    base_updated_at = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
    )


class PushBatchSerializer(serializers.Serializer):
    ops = serializers.ListField(
        child=PushOpSerializer(),
        allow_empty=True,
        max_length=50,
    )


class SyncPushApi(APIView):
    """
    POST /api/sync/push/

    Applies a batch of offline-originated ops with LWW conflict resolution.
    Request body: {"ops": [PushOp, ...]}
    Response: {"success": true, "data": {"results": [...], "server_time": "..."}}
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PushBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ops = serializer.validated_data["ops"]
        # Re-stringify UUIDs so downstream handlers get plain `str` not
        # `uuid.UUID` (the service passes them as **kwargs into
        # pre-existing service functions that accept str/UUID).
        normalized = []
        for op in ops:
            normalized.append({
                "client_id": str(op["client_id"]),
                "resource": op["resource"],
                "op": op["op"],
                "id": str(op["id"]),
                "data": op.get("data") or {},
                "base_updated_at": op.get("base_updated_at") or None,
            })

        result = sync_push(actor=request.user, ops=normalized)
        return Response({"success": True, "data": result}, status=status.HTTP_200_OK)
