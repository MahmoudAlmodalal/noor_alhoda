from django.urls import path

from sync.views.pull_views import SyncPullApi


urlpatterns = [
    path("pull/", SyncPullApi.as_view(), name="sync-pull"),
]
