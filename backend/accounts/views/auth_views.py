
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema, inline_serializer

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
    national_id = serializers.CharField(help_text="رقم الهوية")
    password = serializers.CharField(help_text="كلمة المرور")


class LogoutInputSerializer(serializers.Serializer):
    refresh = serializers.CharField(help_text="Refresh token")


class OTPSendInputSerializer(serializers.Serializer):
    national_id = serializers.CharField(help_text="رقم الهوية")


class OTPVerifyInputSerializer(serializers.Serializer):
    national_id = serializers.CharField(help_text="رقم الهوية")
    code = serializers.CharField(max_length=6, help_text="رمز التحقق المكون من 6 أرقام")
    new_password = serializers.CharField(min_length=6, help_text="كلمة المرور الجديدة")


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class LoginApi(APIView):
    """POST /api/auth/login/ — تسجيل الدخول"""

    permission_classes = [AllowAny]
    throttle_scope = "login"

    @extend_schema(
        request=LoginInputSerializer,
        responses={200: inline_serializer(
            name="LoginResponse",
            fields={
                "success": serializers.BooleanField(),
                "data": inline_serializer(
                    name="LoginData",
                    fields={
                        "access": serializers.CharField(help_text="JWT access token"),
                        "refresh": serializers.CharField(help_text="JWT refresh token"),
                        "user": inline_serializer(
                            name="LoginUser",
                            fields={
                                "id": serializers.UUIDField(),
                                "national_id": serializers.CharField(),
                                "role": serializers.CharField(),
                                "full_name": serializers.CharField(),
                            },
                        ),
                    },
                ),
            },
        )},
        summary="تسجيل الدخول",
        description="تسجيل الدخول باستخدام رقم الهوية وكلمة المرور. يتم قفل الحساب بعد 5 محاولات فاشلة لمدة 30 دقيقة.",
    )
    def post(self, request):
        serializer = LoginInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = user_login(
            national_id=serializer.validated_data["national_id"],
            password=serializer.validated_data["password"],
        )

        return Response({"success": True, "data": result}, status=status.HTTP_200_OK)


class LogoutApi(APIView):
    """POST /api/auth/logout/ — تسجيل الخروج"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=LogoutInputSerializer,
        responses={200: inline_serializer(
            name="LogoutResponse",
            fields={
                "success": serializers.BooleanField(),
                "message": serializers.CharField(),
            },
        )},
        summary="تسجيل الخروج",
        description="إبطال refresh token لتسجيل الخروج.",
    )
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

    @extend_schema(
        request=OTPSendInputSerializer,
        responses={200: inline_serializer(
            name="OTPSendResponse",
            fields={
                "success": serializers.BooleanField(),
                "message": serializers.CharField(),
            },
        )},
        summary="إرسال رمز OTP",
        description="إرسال رمز تحقق مكون من 6 أرقام إلى رقم الهوية المرتبط بالحساب.",
    )
    def post(self, request):
        serializer = OTPSendInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        otp_send(national_id=serializer.validated_data["national_id"])

        return Response(
            {"success": True, "message": "تم إرسال رمز التحقق."},
            status=status.HTTP_200_OK,
        )


class OTPVerifyApi(APIView):
    """POST /api/auth/otp/verify/ — التحقق من رمز OTP وتعيين كلمة مرور جديدة"""

    permission_classes = [AllowAny]

    @extend_schema(
        request=OTPVerifyInputSerializer,
        responses={200: inline_serializer(
            name="OTPVerifyResponse",
            fields={
                "success": serializers.BooleanField(),
                "message": serializers.CharField(),
            },
        )},
        summary="التحقق من رمز OTP",
        description="التحقق من رمز OTP وتعيين كلمة مرور جديدة.",
    )
    def post(self, request):
        serializer = OTPVerifyInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        otp_verify(
            national_id=serializer.validated_data["national_id"],
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

    @extend_schema(
        responses={200: inline_serializer(
            name="MeResponse",
            fields={
                "success": serializers.BooleanField(),
                "data": inline_serializer(
                    name="MeData",
                    fields={
                        "id": serializers.UUIDField(),
                        "national_id": serializers.CharField(),
                        "role": serializers.CharField(),
                        "full_name": serializers.CharField(),
                    },
                ),
            },
        )},
        summary="بيانات المستخدم الحالي",
        description="إرجاع بيانات المستخدم المسجّل حالياً.",
    )
    def get(self, request):
        data = user_get_me(user=request.user)
        return Response({"success": True, "data": data}, status=status.HTTP_200_OK)
