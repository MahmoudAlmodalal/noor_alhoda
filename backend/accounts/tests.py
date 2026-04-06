"""
Authentication & User Management Tests
Covers: FR-01, FR-02, FR-04, FR-05, FR-06, Feature 1.3, Feature 1.4
"""
from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import OTPCode, User, Teacher


class TestSetupMixin:
    """Shared test fixture setup."""

    def create_admin(self):
        return User.objects.create_user(
            phone_number="970590000000",
            username="admin1",
            password="adminpass123",
            role="admin",
            first_name="Admin",
            last_name="User",
        )

    def create_teacher_with_profile(self, suffix="10"):
        user = User.objects.create_user(
            phone_number=f"9705900000{suffix}",
            username=f"teacher{suffix}",
            password="secret123",
            role="teacher",
            first_name="Teacher",
            last_name=f"T{suffix}",
        )
        teacher = Teacher.objects.create(
            user=user,
            full_name=f"Teacher {suffix}",
            session_days=["sat", "sun", "mon", "tue", "wed", "thu"],
        )
        return user, teacher


# ==========================================================================
# A. Authentication Tests (AUTH-01 to AUTH-12)
# ==========================================================================
class LoginApiTests(TestSetupMixin, APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone_number="970590000001",
            username="testuser",
            password="correctpass",
            role="student",
        )

    def test_login_with_valid_credentials_returns_tokens(self):
        """AUTH-01: Valid phone + password returns 200 with access and refresh tokens."""
        response = self.client.post(
            "/api/auth/login/",
            {"phone_number": "970590000001", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertIn("access", response.data["data"])
        self.assertIn("refresh", response.data["data"])
        self.assertEqual(response.data["data"]["user"]["role"], "student")

    def test_login_with_wrong_password_returns_401(self):
        """AUTH-02: Wrong password returns 401."""
        response = self.client.post(
            "/api/auth/login/",
            {"phone_number": "970590000001", "password": "wrongpass"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_login_with_nonexistent_phone_returns_401(self):
        """AUTH-03: Non-existent phone returns 401 (not 404, to prevent enumeration)."""
        response = self.client.post(
            "/api/auth/login/",
            {"phone_number": "999999999999", "password": "anypass"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_login_with_deactivated_account_returns_401(self):
        """AUTH-04: Deactivated account returns 401."""
        self.user.is_active = False
        self.user.save()
        response = self.client.post(
            "/api/auth/login/",
            {"phone_number": "970590000001", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)


class OTPSendApiTests(TestSetupMixin, APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone_number="970590000001",
            username="student1",
            password="secret123",
        )

    @override_settings(DEBUG=False)
    def test_otp_send_hides_code_outside_debug(self):
        """AUTH-05: OTP code never in response (DEBUG=False)."""
        response = self.client.post(
            "/api/auth/otp/send/",
            {"phone_number": self.user.phone_number},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("otp_code_dev_only", response.data)
        otp = OTPCode.objects.get(user=self.user)
        self.assertEqual(len(otp.code_hash), 64)

    @override_settings(DEBUG=True)
    def test_otp_send_does_not_leak_code_in_response(self):
        """AUTH-06: OTP code never in response, even in DEBUG mode (security fix)."""
        response = self.client.post(
            "/api/auth/otp/send/",
            {"phone_number": self.user.phone_number},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("otp_code_dev_only", response.data)
        otp = OTPCode.objects.get(user=self.user)
        self.assertEqual(len(otp.code_hash), 64)

    def test_otp_send_invalidates_previous_codes(self):
        """AUTH-10: Sending new OTP invalidates previous unused ones."""
        self.client.post(
            "/api/auth/otp/send/",
            {"phone_number": self.user.phone_number},
            format="json",
        )
        old_otp = OTPCode.objects.filter(user=self.user, is_used=False).first()
        self.assertIsNotNone(old_otp)

        self.client.post(
            "/api/auth/otp/send/",
            {"phone_number": self.user.phone_number},
            format="json",
        )
        old_otp.refresh_from_db()
        self.assertTrue(old_otp.is_used)
        self.assertEqual(OTPCode.objects.filter(user=self.user, is_used=False).count(), 1)


class OTPVerifyTests(TestSetupMixin, APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone_number="970590000001",
            username="student1",
            password="oldpassword",
        )

    def _create_otp(self, code="123456", expired=False, used=False):
        expires_at = timezone.now() + (
            timedelta(minutes=-1) if expired else timedelta(minutes=10)
        )
        return OTPCode.objects.create(
            user=self.user,
            code_hash=OTPCode.hash_code(code),
            expires_at=expires_at,
            is_used=used,
        )

    def test_otp_verify_with_valid_code_resets_password(self):
        """AUTH-07: Valid OTP resets password successfully."""
        self._create_otp(code="123456")
        response = self.client.post(
            "/api/auth/otp/verify/",
            {
                "phone_number": self.user.phone_number,
                "code": "123456",
                "new_password": "newpass123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpass123"))

    def test_otp_verify_with_expired_code_fails(self):
        """AUTH-08: Expired OTP (>10 min) returns error."""
        self._create_otp(code="123456", expired=True)
        response = self.client.post(
            "/api/auth/otp/verify/",
            {
                "phone_number": self.user.phone_number,
                "code": "123456",
                "new_password": "newpass123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_otp_verify_with_used_code_fails(self):
        """AUTH-09: Already-used OTP returns error."""
        self._create_otp(code="123456", used=True)
        response = self.client.post(
            "/api/auth/otp/verify/",
            {
                "phone_number": self.user.phone_number,
                "code": "123456",
                "new_password": "newpass123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class LogoutApiTests(TestSetupMixin, APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone_number="970590000001",
            username="student1",
            password="secret123",
        )

    def test_logout_blacklists_refresh_token(self):
        """AUTH-11: Logout blacklists refresh token; reuse is rejected."""
        refresh = RefreshToken.for_user(self.user)
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/auth/logout/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        # Reusing the blacklisted token should fail
        response2 = self.client.post(
            "/api/auth/logout/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(response2.status_code, 400)


class MeApiTests(TestSetupMixin, APITestCase):
    def test_me_returns_current_user_profile(self):
        """AUTH-12: /me endpoint returns authenticated user's profile."""
        user = User.objects.create_user(
            phone_number="970590000001",
            username="student1",
            password="secret123",
            role="student",
            first_name="Ahmed",
            last_name="Ali",
        )
        self.client.force_authenticate(user)

        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])


# ==========================================================================
# F. User Management Tests (USR-01 to USR-06)
# ==========================================================================
class UserManagementTests(TestSetupMixin, APITestCase):
    def setUp(self):
        self.admin = self.create_admin()
        self.teacher_user, self.teacher = self.create_teacher_with_profile("10")

    def test_admin_creates_user_successfully(self):
        """USR-01: Admin can create a new user."""
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/users/create/",
            {
                "phone_number": "970590099999",
                "role": "student",
                "first_name": "New",
                "last_name": "Student",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(phone_number="970590099999").exists())

    def test_non_admin_cannot_create_user(self):
        """USR-02: Non-admin gets 403 when creating a user."""
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            "/api/users/create/",
            {
                "phone_number": "970590099998",
                "role": "student",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_duplicate_phone_number_rejected(self):
        """USR-03: Duplicate phone_number returns validation error."""
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/users/create/",
            {
                "phone_number": self.admin.phone_number,
                "role": "student",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_user_can_update_own_name(self):
        """USR-04: User can update own first_name/last_name."""
        self.client.force_authenticate(self.teacher_user)
        response = self.client.patch(
            f"/api/users/{self.teacher_user.id}/",
            {"first_name": "Updated", "last_name": "Name"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.teacher_user.refresh_from_db()
        self.assertEqual(self.teacher_user.first_name, "Updated")

    def test_user_cannot_update_another_users_profile(self):
        """USR-05: Non-admin cannot update another user's profile."""
        other = User.objects.create_user(
            phone_number="970590099997",
            username="other1",
            password="secret123",
            role="student",
        )
        self.client.force_authenticate(other)
        response = self.client.patch(
            f"/api/users/{self.teacher_user.id}/",
            {"first_name": "Hacked"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_can_deactivate_user(self):
        """USR-06: Admin can soft-delete a user."""
        target = User.objects.create_user(
            phone_number="970590099996",
            username="target1",
            password="secret123",
            role="student",
        )
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"/api/users/{target.id}/")
        self.assertEqual(response.status_code, 200)
        target.refresh_from_db()
        self.assertFalse(target.is_active)
