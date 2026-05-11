from django.urls import path

from progress.views.progress_views import (
    ProgressListApi,
    ProgressCreateApi,
    ProgressUpdateApi,
    ProgressDeleteApi,
    SurahListApi,
)

urlpatterns = [
    path("", ProgressListApi.as_view(), name="progress-list"),
    path("create/", ProgressCreateApi.as_view(), name="progress-create"),
    path("<uuid:progress_id>/", ProgressUpdateApi.as_view(), name="progress-update"),
    path("<uuid:progress_id>/delete/", ProgressDeleteApi.as_view(), name="progress-delete"),
    path("surahs/", SurahListApi.as_view(), name="surah-list"),
]
