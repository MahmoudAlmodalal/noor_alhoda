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


def user_login(*, national_id: str, password: str) -> dict:
    """
    Authenticate user by national_id + password. Returns JWT tokens.
    """
    national_id = str(national_id).strip()
    if not national_id:
        raise AuthenticationFailed("رقم الهوية أو كلمة المرور غير صحيحة.")

    try:
        user = User.objects.get(national_id=national_id)
    except User.DoesNotExist:
        raise AuthenticationFailed("رقم الهوية أو كلمة المرور غير صحيحة.")

    # Account Lockout Logic
    if user.lockout_until and user.lockout_until > timezone.now():
        raise AuthenticationFailed("تم قفل الحساب مؤقتًا بسبب محاولات تسجيل الدخول الفاشلة المتكررة. يرجى المحاولة مرة أخرى لاحقًا.")

    if not user.check_password(password):
        user.failed_login_attempts += 1
        user.last_login_attempt = timezone.now()
        if user.failed_login_attempts >= 5:  # Lockout after 5 failed attempts
            user.lockout_until = timezone.now() + timedelta(minutes=30)  # Lockout for 30 minutes
        user.save()
        raise AuthenticationFailed("رقم الهوية أو كلمة المرور غير صحيحة.")

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
            "national_id": user.national_id,
            "role": "admin" if is_admin_user(user) else user.role,
            "full_name": user.get_full_name(),
        },
    }


def user_logout(*, refresh_token: str) -> None:
    """
    Blacklist the refresh token on logout.
    """
    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        raise BusinessLogicError("رمز التحديث غير صالح أو منتهي الصلاحية.")


@transaction.atomic
def otp_send(*, national_id: str) -> None:
    """
    Generate a 6-digit OTP and store its hash based on national ID.
    """
    national_id = str(national_id).strip()

    try:
        user = User.objects.get(national_id=national_id)
    except User.DoesNotExist:
        raise BusinessLogicError("رقم الهوية غير مسجل في النظام.")

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

    # TODO: Integrate SMS gateway to send `code` to the user's phone.
    raise BusinessLogicError("SMS gateway not configured. Cannot send OTP.")


@transaction.atomic
def otp_verify(*, national_id: str, code: str, new_password: str) -> None:
    """
    Verify OTP code and reset password.
    """
    national_id = str(national_id).strip()

    try:
        user = User.objects.get(national_id=national_id)
    except User.DoesNotExist:
        raise BusinessLogicError("رقم الهوية غير مسجل في النظام.")

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
