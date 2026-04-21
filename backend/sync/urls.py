from django.urls import path

from sync.views.pull_views import SyncPullApi
from sync.views.push_views import SyncPushApi


urlpatterns = [
    path("pull/", SyncPullApi.as_view(), name="sync-pull"),
    path("push/", SyncPushApi.as_view(), name="sync-push"),
]
