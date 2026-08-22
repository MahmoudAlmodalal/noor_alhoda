from django.urls import path
from accounts.views.auth_views import (
    LoginApi,
    LogoutApi,
    SafeTokenRefreshApi,
    OTPSendApi,
    OTPVerifyApi,
    MeApi,
)

urlpatterns = [
    path("login/", LoginApi.as_view(), name="auth-login"),
    path("token/refresh/", SafeTokenRefreshApi.as_view(), name="auth-token-refresh"),
    path("logout/", LogoutApi.as_view(), name="auth-logout"),
    path("otp/send/", OTPSendApi.as_view(), name="auth-otp-send"),
    path("otp/verify/", OTPVerifyApi.as_view(), name="auth-otp-verify"),
    path("me/", MeApi.as_view(), name="auth-me"),
]
