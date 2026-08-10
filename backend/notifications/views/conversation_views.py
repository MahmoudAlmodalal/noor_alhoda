from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import IsAuthenticated

from notifications.selectors.notification_selectors import (
    conversation_messages,
    conversation_list_for_user,
)
from notifications.services.notification_services import conversation_reply


class DirectMessageOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    sender_id = serializers.UUIDField(source="sender.id")
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.CharField()
    body = serializers.CharField()
    is_read = serializers.BooleanField()
    created_at = serializers.DateTimeField()

    def get_sender_name(self, obj):
        if obj.sender_role == "student":
            profile = getattr(obj.sender, "student_profile", None)
            return profile.full_name if profile else obj.sender.get_full_name()
        elif obj.sender_role == "teacher":
            profile = getattr(obj.sender, "teacher_profile", None)
            return profile.full_name if profile else obj.sender.get_full_name()
        return obj.sender.get_full_name()


class ConversationListApi(APIView):
    """GET /api/notifications/conversations/ — قائمة المحادثات"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversations = conversation_list_for_user(user=request.user)
        return Response({
            "success": True,
            "data": conversations,
        })


class ConversationDetailApi(APIView):
    """GET /api/notifications/conversations/<student_id>/ — رسائل المحادثة"""
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        # تعيين الرسائل كمقروءة
        messages_qs = conversation_messages(
            student_id=str(student_id), user=request.user
        )
        messages_qs.exclude(sender=request.user).filter(
            is_read=False
        ).update(is_read=True)

        # إعادة جلب بعد التحديث
        messages_qs = conversation_messages(
            student_id=str(student_id), user=request.user
        )

        return Response({
            "success": True,
            "data": DirectMessageOutputSerializer(
                messages_qs, many=True
            ).data,
        })


class ConversationReplyInputSerializer(serializers.Serializer):
    body = serializers.CharField(min_length=1)


class ConversationReplyApi(APIView):
    """POST /api/notifications/conversations/<student_id>/reply/ — إرسال رسالة"""
    permission_classes = [IsAuthenticated]

    def post(self, request, student_id):
        serializer = ConversationReplyInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = conversation_reply(
            sender=request.user,
            student_id=str(student_id),
            body=serializer.validated_data["body"],
        )

        return Response({
            "success": True,
            "data": result,
        }, status=status.HTTP_201_CREATED)
