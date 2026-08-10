from django.urls import path

from notifications.views.notification_views import (
    NotificationListApi,
    NotificationMarkReadApi,
    NotificationMarkAllReadApi,
    AnnouncementCreateApi,
    DirectMessageCreateApi,
    TeacherCircleAnnounceApi,
)
from notifications.views.conversation_views import (
    ConversationListApi,
    ConversationDetailApi,
    ConversationReplyApi,
)

urlpatterns = [
    path("", NotificationListApi.as_view(), name="notification-list"),
    path("<uuid:notification_id>/read/", NotificationMarkReadApi.as_view(), name="notification-read"),
    path("read-all/", NotificationMarkAllReadApi.as_view(), name="notification-read-all"),
    path("announce/", AnnouncementCreateApi.as_view(), name="announcement-create"),
    path("direct-message/", DirectMessageCreateApi.as_view(), name="direct-message-create"),
    path("circle-announce/", TeacherCircleAnnounceApi.as_view(), name="circle-announce"),
    path("conversations/", ConversationListApi.as_view(), name="conversation-list"),
    path("conversations/<uuid:student_id>/", ConversationDetailApi.as_view(), name="conversation-detail"),
    path("conversations/<uuid:student_id>/reply/", ConversationReplyApi.as_view(), name="conversation-reply"),
]
