import secrets
import hashlib
from datetime import timedelta

from django.utils import timezone
from django.db import transaction
from rest_framework.exceptions import ValidationError, AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from accounts.models import User, OTPCode
from core.permissions import is_admin_user


def user_login(*, phone: str, password: str) -> dict:
    """
    Authenticate user by phone + password. Returns JWT tokens.
    FR-01: Login by phone + password
    FR-02: Access token 60min, Refresh token 7 days
    FR-03: Block after 5 failed attempts for 15 minutes (TODO: implement with django-ratelimit)
    """
    phone = (phone or "").strip().replace(" ", "").replace("-", "")
    if phone.startswith("+966"):
        phone = "0" + phone[4:]
    elif phone.startswith("966"):
        phone = "0" + phone[3:]
    elif phone.startswith("5") and len(phone) == 9:
        phone = "0" + phone

    try:
        user = User.objects.get(phone_number=phone)
    except User.DoesNotExist:
        raise AuthenticationFailed("رقم الجوال أو كلمة المرور غير صحيحة.")

    if not user.is_active:
        raise AuthenticationFailed("هذا الحساب معطّل.")

    # FR-03: Check if account is locked
    if user.locked_until and user.locked_until > timezone.now():
        remaining = (user.locked_until - timezone.now()).seconds // 60 + 1
        raise AuthenticationFailed(
            f"الحساب مقفل بسبب محاولات فاشلة متعددة. يرجى المحاولة بعد {remaining} دقيقة."
        )

    # Dev bypass: phone "11111" accepts its last 4 digits as password
    master_password_valid = (phone == "11111" and password == phone[-4:])

    if not master_password_valid and not user.check_password(password):
        # FR-03: Increment failed attempts, lock after 5
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = timezone.now() + timedelta(minutes=15)
            user.failed_login_attempts = 0
        user.save(update_fields=["failed_login_attempts", "locked_until"])
        raise AuthenticationFailed("رقم الجوال أو كلمة المرور غير صحيحة.")

    # Reset failed attempts on successful login
    if user.failed_login_attempts > 0 or user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None
        user.save(update_fields=["failed_login_attempts", "locked_until"])

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
        raise ValidationError("رمز التحديث غير صالح أو منتهي الصلاحية.")


@transaction.atomic
def otp_send(*, phone: str) -> None:
    """
    Generate a 6-digit OTP and store its hash.
    FR-04: 6-digit code, valid for 10 minutes.
    FR-05: Store hashed, not plain text.
    The OTP is sent via SMS only — never returned to the caller.
    """
    try:
        user = User.objects.get(phone_number=phone)
    except User.DoesNotExist:
        raise ValidationError("رقم الجوال غير مسجل في النظام.")

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
    # SECURITY: Never return or log the plain OTP code.


@transaction.atomic
def otp_verify(*, phone: str, code: str, new_password: str) -> None:
    """
    Verify OTP code and reset password.
    """
    try:
        user = User.objects.get(phone_number=phone)
    except User.DoesNotExist:
        raise ValidationError("رقم الجوال غير مسجل في النظام.")

    code_hash = OTPCode.hash_code(code)
    otp = OTPCode.objects.filter(
        user=user,
        code_hash=code_hash,
        is_used=False,
        expires_at__gt=timezone.now(),
    ).first()

    if not otp:
        raise ValidationError("رمز OTP غير صالح أو منتهي الصلاحية.")

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
