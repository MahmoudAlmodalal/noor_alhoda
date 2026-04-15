from django.core.management import call_command
from django.test import TestCase

from accounts.models import OTPCode, ParentStudentLink, Teacher, User
from courses.models import Course, StudentCourse
from notifications.models import Notification
from records.models import DailyRecord, WeeklyPlan
from students.models import Student

from core.management.commands.seed_e2e import E2E_COURSE_NAMES, E2E_PHONES


class SeedE2ECommandTests(TestCase):
    def test_seed_e2e_creates_deterministic_fixture_data(self):
        call_command("seed_e2e", "--quiet")

        self.assertTrue(User.objects.filter(phone_number=E2E_PHONES["admin"], role="admin").exists())
        self.assertTrue(Teacher.objects.filter(user__phone_number=E2E_PHONES["teacher"]).exists())
        self.assertTrue(Student.objects.filter(user__phone_number=E2E_PHONES["student"]).exists())
        self.assertEqual(Course.objects.filter(name__in=E2E_COURSE_NAMES).count(), 2)
        self.assertTrue(StudentCourse.objects.filter(student__user__phone_number=E2E_PHONES["student"]).exists())
        self.assertTrue(WeeklyPlan.objects.filter(student__user__phone_number=E2E_PHONES["student"]).exists())
        self.assertTrue(DailyRecord.objects.filter(weekly_plan__student__user__phone_number=E2E_PHONES["student"]).exists())
        self.assertTrue(Notification.objects.filter(recipient__phone_number=E2E_PHONES["student"]).exists())

    def test_seed_e2e_can_create_known_otp(self):
        call_command("seed_e2e", "--quiet", "--otp-code", "246810")

        user = User.objects.get(phone_number=E2E_PHONES["student"])
        otp = OTPCode.objects.get(user=user, is_used=False)

        self.assertEqual(otp.code_hash, OTPCode.hash_code("246810"))


# ==========================================================================
# Platform & docs smoke tests — plan: /health, /api/, /api/schema/*
# ==========================================================================
from rest_framework.test import APITestCase


class PlatformEndpointSmokeTests(APITestCase):
    def test_health_check_is_public_and_returns_ok(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response.json()["status"], "ok")

    def test_api_root_is_public_and_lists_endpoints(self):
        response = self.client.get("/api/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("endpoints", body)
        for expected in ("auth", "users", "students", "records", "notifications", "reports"):
            self.assertIn(expected, body["endpoints"])

    def test_schema_endpoint_is_public_and_serves_openapi(self):
        response = self.client.get("/api/schema/")
        self.assertEqual(response.status_code, 200)
        content_type = response["Content-Type"]
        self.assertTrue(
            "yaml" in content_type or "json" in content_type or "vnd.oai" in content_type,
            f"unexpected schema content type: {content_type}",
        )

    def test_swagger_ui_is_public(self):
        response = self.client.get("/api/schema/swagger-ui/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response["Content-Type"])

    def test_redoc_is_public(self):
        response = self.client.get("/api/schema/redoc/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response["Content-Type"])
