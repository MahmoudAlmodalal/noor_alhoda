from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import IsAuthenticated

from notifications.selectors.notification_selectors import (
    notification_list,
    notification_unread_count,
)
from notifications.services.notification_services import (
    notification_mark_read,
    notification_mark_all_read,
)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
class NotificationOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    type = serializers.CharField()
    title = serializers.CharField()
    body = serializers.CharField()
    is_read = serializers.BooleanField()
    created_at = serializers.DateTimeField()


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class NotificationListApi(APIView):
    """GET /api/notifications/ — قائمة إشعارات المستخدم"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = notification_list(user=request.user)
        unread = notification_unread_count(user=request.user)

        return Response(
            {
                "success": True,
                "unread_count": unread,
                "data": NotificationOutputSerializer(notifications, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationMarkReadApi(APIView):
    """PATCH /api/notifications/<id>/read/ — تعيين إشعار كمقروء"""

    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id):
        notification = notification_mark_read(
            notification_id=notification_id,
            user=request.user,
        )
        return Response(
            {"success": True, "data": NotificationOutputSerializer(notification).data},
            status=status.HTTP_200_OK,
        )


class NotificationMarkAllReadApi(APIView):
    """PATCH /api/notifications/read-all/ — تعيين كل الإشعارات كمقروءة"""

    permission_classes = [IsAuthenticated]

    def patch(self, request):
        count = notification_mark_all_read(user=request.user)
        return Response(
            {"success": True, "message": f"تم تعيين {count} إشعار كمقروء."},
            status=status.HTTP_200_OK,
        )
