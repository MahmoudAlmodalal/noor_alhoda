import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import AllowAny, IsAuthenticated

logger = logging.getLogger(__name__)

from accounts.services.auth_services import (
    user_login,
    user_logout,
    otp_send,
    otp_verify,
)
from accounts.selectors.auth_selectors import user_get_me


# ---------------------------------------------------------------------------
# Serializers (inline)
# ---------------------------------------------------------------------------
class LoginInputSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    password = serializers.CharField()


class LogoutInputSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class OTPSendInputSerializer(serializers.Serializer):
    phone_number = serializers.CharField()


class OTPVerifyInputSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=6)


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class LoginApi(APIView):
    """POST /api/auth/login/ — تسجيل الدخول"""

    permission_classes = [AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = user_login(
            phone=serializer.validated_data["phone_number"],
            password=serializer.validated_data["password"],
        )

        return Response({"success": True, "data": result}, status=status.HTTP_200_OK)


class LogoutApi(APIView):
    """POST /api/auth/logout/ — تسجيل الخروج"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_logout(refresh_token=serializer.validated_data["refresh"])

        return Response(
            {"success": True, "message": "تم تسجيل الخروج بنجاح."},
            status=status.HTTP_200_OK,
        )


class OTPSendApi(APIView):
    """POST /api/auth/otp/send/ — إرسال رمز OTP"""

    permission_classes = [AllowAny]
    throttle_scope = "otp"

    def post(self, request):
        serializer = OTPSendInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = otp_send(phone=serializer.validated_data["phone_number"])

        # Log OTP for development debugging only — never expose in response
        logger.debug("OTP code for %s: %s", serializer.validated_data["phone_number"], code)

        return Response(
            {"success": True, "message": "تم إرسال رمز التحقق."},
            status=status.HTTP_200_OK,
        )


class OTPVerifyApi(APIView):
    """POST /api/auth/otp/verify/ — التحقق من رمز OTP وتعيين كلمة مرور جديدة"""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPVerifyInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        otp_verify(
            phone=serializer.validated_data["phone_number"],
            code=serializer.validated_data["code"],
            new_password=serializer.validated_data["new_password"],
        )

        return Response(
            {"success": True, "message": "تم تغيير كلمة المرور بنجاح."},
            status=status.HTTP_200_OK,
        )


class MeApi(APIView):
    """GET /api/auth/me/ — بيانات المستخدم الحالي"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = user_get_me(user=request.user)
        return Response({"success": True, "data": data}, status=status.HTTP_200_OK)
