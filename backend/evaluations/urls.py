from django.urls import path

from evaluations.views.evaluation_views import (
    EvaluationListCreateApi,
    EvaluationDetailApi,
)


urlpatterns = [
    path("", EvaluationListCreateApi.as_view(), name="evaluation-list-create"),
    path("<uuid:evaluation_id>/", EvaluationDetailApi.as_view(), name="evaluation-detail"),
]
