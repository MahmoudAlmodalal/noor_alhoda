from django.urls import path

from notifications.views.notification_views import (
    NotificationListApi,
    NotificationMarkReadApi,
    NotificationMarkAllReadApi,
)

urlpatterns = [
    path("", NotificationListApi.as_view(), name="notification-list"),
    path("<uuid:notification_id>/read/", NotificationMarkReadApi.as_view(), name="notification-read"),
    path("read-all/", NotificationMarkAllReadApi.as_view(), name="notification-read-all"),
]
