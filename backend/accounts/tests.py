"""
Accounts tests — auth (login/refresh/logout/otp/me) + user + teacher endpoints.

Contract matrix per the backend API test plan. Known contract drift is tagged
with ``@unittest.expectedFailure`` so drift stays visible and does not get
confused with accidental regressions:

* auth login has no ``is_active`` check (inactive users can still log in)
* ``UserInputSerializer`` / ``TeacherInputSerializer`` drop ``national_id``
  even though the services require it, so the happy-path POSTs are unreachable
* ``UserUpdateSerializer`` drops ``national_id`` so admin cannot patch it via
  the endpoint
* ``otp_send`` always raises ``SMS gateway not configured`` and rolls its
  transaction back, so OTP persistence cannot be observed through the endpoint
* ``user_delete`` hard-deletes, but the product-intent regression case asserts
  the soft-delete contract
"""

import unittest
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import (
    OTPCode,
    Parent,
    ParentStudentLink,
    Teacher,
    User,
)
from students.models import Student


LOGIN_URL = "/api/auth/login/"
REFRESH_URL = "/api/auth/token/refresh/"
LOGOUT_URL = "/api/auth/logout/"
OTP_SEND_URL = "/api/auth/otp/send/"
OTP_VERIFY_URL = "/api/auth/otp/verify/"
ME_URL = "/api/auth/me/"
USERS_URL = "/api/users/"
USER_CREATE_URL = "/api/users/create/"
TEACHERS_URL = "/api/users/teachers/"
TEACHER_CREATE_URL = "/api/users/teachers/create/"


# ==========================================================================
# Fixtures
# ==========================================================================
class AccountsFixture:
    """Factory helpers that use ``national_id`` as the login field."""

    def make_admin(self, nid="1000000001", password="adminpass"):
        return User.objects.create_user(
            national_id=nid,
            phone_number="0591" + nid[-6:],
            password=password,
            role="admin",
            first_name="Admin",
            last_name="Account",
        )

    def make_teacher(
        self,
        nid="1000000002",
        password="teacherpass",
        with_profile=True,
        max_students=25,
    ):
        user = User.objects.create_user(
            national_id=nid,
            phone_number="0591" + nid[-6:],
            password=password,
            role="teacher",
            first_name="Ted",
            last_name="Teacher",
        )
        if with_profile:
            Teacher.objects.create(
                user=user,
                full_name="Ted Teacher",
                session_days=["sat", "sun", "mon", "tue", "wed", "thu"],
                max_students=max_students,
                specialization="",
                affiliation="",
            )
        return user

    def make_student_user(self, nid="1000000004", password="studentpass"):
        return User.objects.create_user(
            national_id=nid,
            phone_number="0591" + nid[-6:],
            password=password,
            role="student",
            first_name="Sam",
            last_name="Student",
        )

    def make_parent_user(self, nid="1000000005", password="parentpass", full_name="Pat Parent"):
        user = User.objects.create_user(
            national_id=nid,
            phone_number="0591" + nid[-6:],
            password=password,
            role="parent",
            first_name="Pat",
            last_name="Parent",
        )
        Parent.objects.create(user=user, full_name=full_name)
        return user

    def make_student_record(self, teacher=None, nid_suffix="SX1", full_name="Sara Student"):
        from datetime import date

        user = User.objects.create_user(
            national_id=f"STU-USER-{nid_suffix}",
            phone_number=f"059100{nid_suffix[-4:]}",
            password="studentpass",
            role="student",
            first_name=full_name.split()[0],
            last_name=full_name.split()[-1],
        )
        return Student.objects.create(
            user=user,
            full_name=full_name,
            national_id=f"STU-{nid_suffix}",
            birthdate=date(2012, 1, 1),
            grade="Grade 5",
            mobile=user.phone_number,
            guardian_name="Guardian",
            guardian_mobile="0599000111",
            teacher=teacher,
        )


# ==========================================================================
# Login
# ==========================================================================
class LoginApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            national_id="9990000001",
            phone_number="0599000001",
            password="correctpass",
            role="student",
            first_name="Login",
            last_name="User",
        )

    def test_valid_credentials_return_tokens_and_user_payload(self):
        response = self.client.post(
            LOGIN_URL,
            {"national_id": "9990000001", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.data
        self.assertTrue(body["success"])
        self.assertIn("access", body["data"])
        self.assertIn("refresh", body["data"])
        user = body["data"]["user"]
        self.assertEqual(user["national_id"], "9990000001")
        self.assertEqual(user["role"], "student")
        self.assertIn("id", user)
        self.assertIn("full_name", user)

    def test_wrong_password_returns_401_envelope(self):
        response = self.client.post(
            LOGIN_URL,
            {"national_id": "9990000001", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["error"]["code"], 401)

    def test_unknown_national_id_returns_401(self):
        response = self.client.post(
            LOGIN_URL,
            {"national_id": "0000000000", "password": "whatever"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    @unittest.expectedFailure
    def test_inactive_user_cannot_login(self):
        """Drift: ``user_login`` has no is_active check."""
        self.user.is_active = False
        self.user.save()
        response = self.client.post(
            LOGIN_URL,
            {"national_id": "9990000001", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_lockout_rejects_login_with_dedicated_message(self):
        self.user.failed_login_attempts = 5
        self.user.lockout_until = timezone.now() + timedelta(minutes=30)
        self.user.save()
        response = self.client.post(
            LOGIN_URL,
            {"national_id": "9990000001", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("قفل", response.data["error"]["message"])

    def test_five_failed_attempts_set_lockout_on_user_record(self):
        for _ in range(5):
            self.client.post(
                LOGIN_URL,
                {"national_id": "9990000001", "password": "nope"},
                format="json",
            )
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 5)
        self.assertIsNotNone(self.user.lockout_until)

    def test_login_is_throttled_after_five_requests_per_minute(self):
        cache.clear()
        for _ in range(5):
            self.client.post(
                LOGIN_URL,
                {"national_id": "0000000000", "password": "x"},
                format="json",
            )
        response = self.client.post(
            LOGIN_URL,
            {"national_id": "0000000000", "password": "x"},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    def test_missing_fields_return_400(self):
        response = self.client.post(LOGIN_URL, {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_successful_login_resets_failed_attempts(self):
        self.user.failed_login_attempts = 3
        self.user.save()
        response = self.client.post(
            LOGIN_URL,
            {"national_id": "9990000001", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 0)
        self.assertIsNone(self.user.lockout_until)


# ==========================================================================
# Token refresh
# ==========================================================================
class TokenRefreshApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        cache.clear()
        self.user = self.make_student_user()

    def test_valid_refresh_rotates_access_and_refresh(self):
        refresh = RefreshToken.for_user(self.user)
        response = self.client.post(
            REFRESH_URL, {"refresh": str(refresh)}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertNotEqual(response.data["refresh"], str(refresh))

    def test_reused_refresh_after_rotation_is_blacklisted(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.post(REFRESH_URL, {"refresh": str(refresh)}, format="json")
        response = self.client.post(
            REFRESH_URL, {"refresh": str(refresh)}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_malformed_refresh_returns_401(self):
        response = self.client.post(
            REFRESH_URL, {"refresh": "not-a-jwt"}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_missing_refresh_returns_400(self):
        response = self.client.post(REFRESH_URL, {}, format="json")
        self.assertEqual(response.status_code, 400)


# ==========================================================================
# Logout
# ==========================================================================
class LogoutApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        cache.clear()
        self.user = self.make_student_user()

    def test_authenticated_logout_blacklists_refresh_token(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.force_authenticate(self.user)
        response = self.client.post(
            LOGOUT_URL, {"refresh": str(refresh)}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        with self.assertRaises(TokenError):
            RefreshToken(str(refresh))

    def test_replay_logout_with_same_refresh_returns_400(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.force_authenticate(self.user)
        self.client.post(LOGOUT_URL, {"refresh": str(refresh)}, format="json")
        response = self.client.post(
            LOGOUT_URL, {"refresh": str(refresh)}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_missing_refresh_returns_400(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(LOGOUT_URL, {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_unauthenticated_logout_returns_401(self):
        response = self.client.post(
            LOGOUT_URL, {"refresh": "whatever"}, format="json"
        )
        self.assertEqual(response.status_code, 401)


# ==========================================================================
# OTP send
# ==========================================================================
class OtpSendApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        cache.clear()
        self.user = self.make_student_user(nid="7770000001")

    def test_otp_send_returns_sms_gateway_unconfigured_error(self):
        """Current state: ``otp_send`` always raises BusinessLogicError(400)."""
        response = self.client.post(
            OTP_SEND_URL, {"national_id": self.user.national_id}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_otp_send_response_never_leaks_six_digit_code(self):
        response = self.client.post(
            OTP_SEND_URL, {"national_id": self.user.national_id}, format="json"
        )
        import re
        body = str(response.data)
        self.assertNotIn("code_hash", body)
        self.assertIsNone(re.search(r"\b\d{6}\b", body))

    def test_otp_send_unknown_national_id_returns_400(self):
        response = self.client.post(
            OTP_SEND_URL, {"national_id": "0000000000"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_otp_send_missing_national_id_returns_400(self):
        response = self.client.post(OTP_SEND_URL, {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_otp_send_is_throttled_after_three_requests_per_minute(self):
        cache.clear()
        for _ in range(3):
            self.client.post(
                OTP_SEND_URL,
                {"national_id": self.user.national_id},
                format="json",
            )
        response = self.client.post(
            OTP_SEND_URL, {"national_id": self.user.national_id}, format="json"
        )
        self.assertEqual(response.status_code, 429)

    @unittest.expectedFailure
    def test_otp_send_returns_200_when_sms_gateway_configured(self):
        """Drift: target contract is 200 with no code leakage."""
        response = self.client.post(
            OTP_SEND_URL, {"national_id": self.user.national_id}, format="json"
        )
        self.assertEqual(response.status_code, 200)

    @unittest.expectedFailure
    def test_otp_send_persists_new_otp_and_invalidates_previous(self):
        """Drift: current ``@transaction.atomic`` rolls back the create."""
        self.client.post(
            OTP_SEND_URL, {"national_id": self.user.national_id}, format="json"
        )
        self.assertEqual(
            OTPCode.objects.filter(user=self.user, is_used=False).count(), 1
        )


# ==========================================================================
# OTP verify
# ==========================================================================
class OtpVerifyApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            national_id="6660000001",
            phone_number="0599666001",
            password="oldpassword",
            role="student",
        )

    def _create_otp(self, code="123456", expired=False, used=False):
        return OTPCode.objects.create(
            user=self.user,
            code_hash=OTPCode.hash_code(code),
            expires_at=timezone.now()
            + (timedelta(minutes=-1) if expired else timedelta(minutes=10)),
            is_used=used,
        )

    def test_valid_code_resets_password(self):
        self._create_otp("123456")
        response = self.client.post(
            OTP_VERIFY_URL,
            {
                "national_id": self.user.national_id,
                "code": "123456",
                "new_password": "newpass123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpass123"))

    def test_expired_code_fails_400(self):
        self._create_otp("123456", expired=True)
        response = self.client.post(
            OTP_VERIFY_URL,
            {
                "national_id": self.user.national_id,
                "code": "123456",
                "new_password": "newpass123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_used_code_fails_400(self):
        self._create_otp("123456", used=True)
        response = self.client.post(
            OTP_VERIFY_URL,
            {
                "national_id": self.user.national_id,
                "code": "123456",
                "new_password": "newpass123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_wrong_code_fails_400(self):
        self._create_otp("123456")
        response = self.client.post(
            OTP_VERIFY_URL,
            {
                "national_id": self.user.national_id,
                "code": "000000",
                "new_password": "newpass123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("oldpassword"))

    def test_short_new_password_fails_400(self):
        self._create_otp("123456")
        response = self.client.post(
            OTP_VERIFY_URL,
            {
                "national_id": self.user.national_id,
                "code": "123456",
                "new_password": "abc",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_successful_verify_blacklists_outstanding_refresh_tokens(self):
        refresh = RefreshToken.for_user(self.user)
        refresh_str = str(refresh)
        self._create_otp("123456")
        self.client.post(
            OTP_VERIFY_URL,
            {
                "national_id": self.user.national_id,
                "code": "123456",
                "new_password": "newpass123",
            },
            format="json",
        )
        with self.assertRaises(TokenError):
            RefreshToken(refresh_str)

    def test_unknown_national_id_returns_400(self):
        response = self.client.post(
            OTP_VERIFY_URL,
            {
                "national_id": "0000000000",
                "code": "123456",
                "new_password": "newpass123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


# ==========================================================================
# /me
# ==========================================================================
class MeApiTests(AccountsFixture, APITestCase):
    def test_admin_me_returns_admin_role(self):
        admin = self.make_admin()
        self.client.force_authenticate(admin)
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["role"], "admin")

    def test_teacher_me_includes_teacher_profile(self):
        teacher = self.make_teacher()
        self.client.force_authenticate(teacher)
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["role"], "teacher")
        self.assertIn("teacher_profile", data)
        self.assertEqual(data["teacher_profile"]["full_name"], "Ted Teacher")

    def test_student_me_includes_student_profile_when_present(self):
        teacher = self.make_teacher(nid="1000000022")
        student_record = self.make_student_record(teacher=teacher.teacher_profile)
        self.client.force_authenticate(student_record.user)
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["role"], "student")
        self.assertIn("student_profile", data)

    def test_parent_me_lists_linked_children(self):
        parent_user = self.make_parent_user()
        teacher = self.make_teacher(nid="1000000033")
        student = self.make_student_record(teacher=teacher.teacher_profile)
        ParentStudentLink.objects.create(
            parent=parent_user.parent_profile, student=student
        )
        self.client.force_authenticate(parent_user)
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["role"], "parent")
        self.assertEqual(len(data["parent_profile"]["children"]), 1)

    def test_unauthenticated_me_returns_401(self):
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, 401)


# ==========================================================================
# Users: list
# ==========================================================================
class UserListApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        self.admin = self.make_admin()
        self.teacher = self.make_teacher()
        self.student = self.make_student_user()

    def test_admin_lists_all_users(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(USERS_URL)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertGreaterEqual(len(response.data["data"]), 3)

    def test_admin_filter_by_role(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(USERS_URL + "?role=teacher")
        self.assertEqual(response.status_code, 200)
        roles = {u["role"] for u in response.data["data"]}
        self.assertEqual(roles, {"teacher"})

    def test_admin_search_by_name(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(USERS_URL + "?search=Ted")
        self.assertEqual(response.status_code, 200)
        names = {u["first_name"] for u in response.data["data"]}
        self.assertIn("Ted", names)

    def test_non_admin_cannot_list_users(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.get(USERS_URL)
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_list_returns_401(self):
        response = self.client.get(USERS_URL)
        self.assertEqual(response.status_code, 401)


# ==========================================================================
# Users: create
# ==========================================================================
class UserCreateApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        self.admin = self.make_admin()
        self.teacher = self.make_teacher()

    @unittest.expectedFailure
    def test_admin_create_parent_success(self):
        """Drift: ``UserInputSerializer`` has no ``national_id`` field."""
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            USER_CREATE_URL,
            {
                "national_id": "2000000001",
                "phone_number": "0598000001",
                "role": "parent",
                "first_name": "New",
                "last_name": "Parent",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            User.objects.filter(national_id="2000000001").exists()
        )

    def test_missing_national_id_returns_400_from_service(self):
        """Reflects current drift: the service requires ``national_id``."""
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            USER_CREATE_URL,
            {
                "phone_number": "0598000002",
                "role": "parent",
                "first_name": "No",
                "last_name": "NationalId",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_duplicate_national_id_returns_400(self):
        """Currently reaches ``national_id required`` because the serializer drops the field."""
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            USER_CREATE_URL,
            {
                "national_id": self.admin.national_id,
                "phone_number": "0598000003",
                "role": "parent",
                "first_name": "Dup",
                "last_name": "Parent",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_student_role_creation_is_forbidden_by_service(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            USER_CREATE_URL,
            {
                "phone_number": "0598000004",
                "role": "student",
                "first_name": "Not",
                "last_name": "Allowed",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_non_admin_cannot_create_user(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.post(
            USER_CREATE_URL,
            {
                "phone_number": "0598000005",
                "role": "parent",
                "first_name": "Forbidden",
                "last_name": "Actor",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_create_returns_401(self):
        response = self.client.post(
            USER_CREATE_URL,
            {
                "phone_number": "0598000006",
                "role": "parent",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 401)


# ==========================================================================
# Users: detail GET
# ==========================================================================
class UserDetailGetApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        self.admin = self.make_admin()
        self.teacher = self.make_teacher()
        self.student = self.make_student_user()

    def test_admin_reads_any_user(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{USERS_URL}{self.teacher.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["id"], str(self.teacher.id))

    def test_self_reads_self(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.get(f"{USERS_URL}{self.teacher.id}/")
        self.assertEqual(response.status_code, 200)

    def test_other_non_admin_forbidden(self):
        self.client.force_authenticate(self.student)
        response = self.client.get(f"{USERS_URL}{self.teacher.id}/")
        self.assertEqual(response.status_code, 403)

    def test_missing_user_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            f"{USERS_URL}00000000-0000-0000-0000-000000000000/"
        )
        self.assertEqual(response.status_code, 404)


# ==========================================================================
# Users: detail PATCH
# ==========================================================================
class UserPatchApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        self.admin = self.make_admin()
        self.teacher = self.make_teacher()
        self.student = self.make_student_user()

    def test_self_patch_allowed_fields(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.patch(
            f"{USERS_URL}{self.teacher.id}/",
            {"first_name": "Updated", "last_name": "Name"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.teacher.refresh_from_db()
        self.assertEqual(self.teacher.first_name, "Updated")

    def test_admin_patches_role(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{USERS_URL}{self.student.id}/",
            {"role": "parent"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.role, "parent")

    def test_admin_updates_password_changes_credentials(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{USERS_URL}{self.student.id}/",
            {"password": "brandnewpass"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password("brandnewpass"))

    def test_admin_updates_teacher_profile_fields(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{USERS_URL}{self.teacher.id}/",
            {
                "specialization": "تحفيظ",
                "affiliation": "awqaf",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.teacher.teacher_profile.refresh_from_db()
        self.assertEqual(self.teacher.teacher_profile.specialization, "تحفيظ")
        self.assertEqual(self.teacher.teacher_profile.affiliation, "awqaf")

    def test_other_user_cannot_patch_someone_else(self):
        self.client.force_authenticate(self.student)
        response = self.client.patch(
            f"{USERS_URL}{self.teacher.id}/",
            {"first_name": "Hacked"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    @unittest.expectedFailure
    def test_admin_can_patch_national_id(self):
        """Drift: ``UserUpdateSerializer`` has no ``national_id`` field."""
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{USERS_URL}{self.student.id}/",
            {"national_id": "3000000099"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.national_id, "3000000099")


# ==========================================================================
# Users: detail DELETE
# ==========================================================================
class UserDeleteApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        self.admin = self.make_admin()
        self.teacher = self.make_teacher()
        self.student = self.make_student_user()

    def test_admin_delete_hard_deletes_current_behavior(self):
        target_id = self.student.id
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"{USERS_URL}{target_id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(id=target_id).exists())

    @unittest.expectedFailure
    def test_admin_delete_should_soft_delete(self):
        """Product-intent regression: soft-delete (``is_active=False``)."""
        self.client.force_authenticate(self.admin)
        self.client.delete(f"{USERS_URL}{self.student.id}/")
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_active)

    def test_non_admin_delete_forbidden(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.delete(f"{USERS_URL}{self.student.id}/")
        self.assertEqual(response.status_code, 403)

    def test_missing_user_delete_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(
            f"{USERS_URL}00000000-0000-0000-0000-000000000000/"
        )
        self.assertEqual(response.status_code, 404)


# ==========================================================================
# Teachers: list
# ==========================================================================
class TeacherListApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        self.admin = self.make_admin()
        self.teacher = self.make_teacher()
        self.teacher_two = self.make_teacher(nid="1000000077")
        self.student = self.make_student_user()
        self.parent = self.make_parent_user()

    def test_admin_lists_teachers(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(TEACHERS_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 2)

    def test_teacher_can_list_teachers(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.get(TEACHERS_URL)
        self.assertEqual(response.status_code, 200)

    def test_student_cannot_list_teachers(self):
        self.client.force_authenticate(self.student)
        response = self.client.get(TEACHERS_URL)
        self.assertEqual(response.status_code, 403)

    def test_parent_cannot_list_teachers(self):
        self.client.force_authenticate(self.parent)
        response = self.client.get(TEACHERS_URL)
        self.assertEqual(response.status_code, 403)

    def test_search_filter(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(TEACHERS_URL + "?search=Ted")
        self.assertEqual(response.status_code, 200)
        for row in response.data["data"]:
            self.assertIn("Ted", row["full_name"])

    def test_response_includes_profile_fields_used_by_frontend(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(TEACHERS_URL)
        row = response.data["data"][0]
        for field in (
            "id",
            "user_id",
            "phone_number",
            "full_name",
            "specialization",
            "affiliation",
            "session_days",
            "max_students",
        ):
            self.assertIn(field, row)


# ==========================================================================
# Teachers: create
# ==========================================================================
class TeacherCreateApiTests(AccountsFixture, APITestCase):
    def setUp(self):
        self.admin = self.make_admin()
        self.teacher = self.make_teacher()

    @unittest.expectedFailure
    def test_admin_creates_teacher_happy_path(self):
        """Drift: ``TeacherInputSerializer`` has no ``national_id`` field."""
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            TEACHER_CREATE_URL,
            {
                "national_id": "4000000001",
                "phone_number": "0597000001",
                "full_name": "New Teacher",
                "first_name": "New",
                "last_name": "Teacher",
                "specialization": "تجويد",
                "affiliation": "dar_quran",
                "session_days": ["sat", "sun"],
                "max_students": 20,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    @unittest.expectedFailure
    def test_missing_national_id_returns_400(self):
        """Drift: ``teacher_create`` does ``data["national_id"]`` and crashes with 500."""
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            TEACHER_CREATE_URL,
            {
                "phone_number": "0597000002",
                "full_name": "Missing NID Teacher",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_non_admin_cannot_create_teacher(self):
        self.client.force_authenticate(self.teacher)
        response = self.client.post(
            TEACHER_CREATE_URL,
            {
                "phone_number": "0597000003",
                "full_name": "Forbidden Teacher",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_returns_401(self):
        response = self.client.post(
            TEACHER_CREATE_URL,
            {"phone_number": "0597000004", "full_name": "Nope"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)
