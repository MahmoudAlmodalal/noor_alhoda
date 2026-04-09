"""
Root URL configuration for Noor Al-Huda.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from core.views import health_check

urlpatterns = [
    path("health", health_check, name="health"),
    path("admin/", admin.site.urls),

    # API schema & docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/schema/swagger-ui/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # App APIs
    path("api/auth/", include("accounts.urls.auth_urls")),
    path("api/users/", include("accounts.urls.user_urls")),
    path("api/students/", include("students.urls")),
    path("api/records/", include("records.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/reports/", include("reports.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
