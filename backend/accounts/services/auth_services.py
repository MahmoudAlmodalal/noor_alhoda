import secrets
import hashlib
from datetime import timedelta

from django.utils import timezone
from django.db import transaction
from rest_framework.exceptions import AuthenticationFailed
from core.exceptions import BusinessLogicError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from accounts.models import User, OTPCode
from accounts.utils import normalize_phone
from core.permissions import is_admin_user


def user_login(*, phone: str, password: str) -> dict:
    """
    Authenticate user by phone + password. Returns JWT tokens.
    FR-01: Login by phone + password
    FR-02: Access token 60min, Refresh token 7 days
    """
    try:
        phone = normalize_phone(phone)
    except ValidationError:
        raise AuthenticationFailed("رقم الجوال/الهوية أو كلمة المرور غير صحيحة.")

    try:
        user = User.objects.get(phone_number=phone)
    except User.DoesNotExist:
        raise AuthenticationFailed("رقم الجوال/الهوية أو كلمة المرور غير صحيحة.")

    # Account Lockout Logic
    if user.lockout_until and user.lockout_until > timezone.now():
        raise AuthenticationFailed("تم قفل الحساب مؤقتًا بسبب محاولات تسجيل الدخول الفاشلة المتكررة. يرجى المحاولة مرة أخرى لاحقًا.")

    if not user.check_password(password):
        user.failed_login_attempts += 1
        user.last_login_attempt = timezone.now()
        if user.failed_login_attempts >= 5:  # Lockout after 5 failed attempts
            user.lockout_until = timezone.now() + timedelta(minutes=30)  # Lockout for 30 minutes
        user.save()
        raise AuthenticationFailed("رقم الجوال/الهوية أو كلمة المرور غير صحيحة.")

    # Reset failed login attempts on successful login
    if user.failed_login_attempts > 0:
        user.failed_login_attempts = 0
        user.lockout_until = None
        user.last_login_attempt = None
        user.save()

    refresh = RefreshToken.for_user(user)

    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": str(user.id),
            "phone_number": user.phone_number,
            "role": "admin" if is_admin_user(user) else user.role,
            "full_name": user.get_full_name(),
        },
    }


def user_logout(*, refresh_token: str) -> None:
    """
    Blacklist the refresh token on logout.
    FR-06: Invalidate refresh token on logout.
    """
    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        raise BusinessLogicError("رمز التحديث غير صالح أو منتهي الصلاحية.")


@transaction.atomic
def otp_send(*, phone: str) -> None:
    """
    Generate a 6-digit OTP and store its hash.
    FR-04: 6-digit code, valid for 10 minutes.
    FR-05: Store hashed, not plain text.
    The OTP is sent via SMS only — never returned to the caller.
    """
    phone = normalize_phone(phone)

    try:
        user = User.objects.get(phone_number=phone)
    except User.DoesNotExist:
        raise BusinessLogicError("رقم الجوال غير مسجل في النظام.")

    # Invalidate old OTPs
    OTPCode.objects.filter(user=user, is_used=False).update(is_used=True)

    # Generate 6-digit code (cryptographically secure)
    code = f"{secrets.randbelow(900000) + 100000}"
    code_hash = OTPCode.hash_code(code)

    OTPCode.objects.create(
        user=user,
        code_hash=code_hash,
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    # TODO: Integrate SMS gateway (e.g. Twilio) to send `code` to the user's phone.
    # For now, raise an error to indicate that SMS integration is missing.
    raise BusinessLogicError("SMS gateway not configured. Cannot send OTP.")
    # SECURITY: Never return or log the plain OTP code.


@transaction.atomic
def otp_verify(*, phone: str, code: str, new_password: str) -> None:
    """
    Verify OTP code and reset password.
    """
    phone = normalize_phone(phone)

    try:
        user = User.objects.get(phone_number=phone)
    except User.DoesNotExist:
        raise BusinessLogicError("رقم الجوال غير مسجل في النظام.")

    code_hash = OTPCode.hash_code(code)
    otp = OTPCode.objects.filter(
        user=user,
        code_hash=code_hash,
        is_used=False,
        expires_at__gt=timezone.now(),
    ).first()

    if not otp:
        raise BusinessLogicError("رمز OTP غير صالح أو منتهي الصلاحية.")

    # Mark as used
    otp.is_used = True
    otp.save()

    # Reset password
    user.set_password(new_password)
    user.save()

    # Invalidate all active refresh tokens for this user
    outstanding = OutstandingToken.objects.filter(user=user)
    for token in outstanding:
        BlacklistedToken.objects.get_or_create(token=token)
