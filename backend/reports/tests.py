"""
Report Tests
Covers: Features 5.1-5.5
"""
from datetime import date

from rest_framework.test import APITestCase

from accounts.models import Teacher, User
from records.models import DailyRecord, WeeklyPlan
from students.models import Student


class ReportTestSetup(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            phone_number="970590400000",
            password="adminpass", role="admin",
        )

        self.teacher_user_1 = User.objects.create_user(
            phone_number="970590400010",
            password="secret123", role="teacher",
        )
        self.teacher_1 = Teacher.objects.create(
            user=self.teacher_user_1, full_name="Teacher Rep 1",
        )

        self.teacher_user_2 = User.objects.create_user(
            phone_number="970590400020",
            password="secret123", role="teacher",
        )
        self.teacher_2 = Teacher.objects.create(
            user=self.teacher_user_2, full_name="Teacher Rep 2",
        )

        self.student_user_1 = User.objects.create_user(
            phone_number="970590400030",
            password="secret123", role="student",
        )
        self.student_1 = Student.objects.create(
            user=self.student_user_1, full_name="Student Rep 1",
            national_id="REP-001", birthdate=date(2011, 1, 1),
            grade="Grade 8", teacher=self.teacher_1,
        )

        self.student_user_2 = User.objects.create_user(
            phone_number="970590400040",
            password="secret123", role="student",
        )
        self.student_2 = Student.objects.create(
            user=self.student_user_2, full_name="Student Rep 2",
            national_id="REP-002", birthdate=date(2011, 2, 2),
            grade="Grade 8", teacher=self.teacher_2,
        )

        self.plan_1 = WeeklyPlan.objects.create(
            student=self.student_1, week_number=1,
            week_start=date(2026, 4, 4), total_required=10, total_achieved=8,
        )
        self.plan_2 = WeeklyPlan.objects.create(
            student=self.student_2, week_number=1,
            week_start=date(2026, 4, 4), total_required=10, total_achieved=6,
        )

        DailyRecord.objects.create(
            weekly_plan=self.plan_1, day="sat", date=date(2026, 4, 4),
            attendance="present", required_verses=10, achieved_verses=8,
            recorded_by=self.teacher_user_1,
        )
        DailyRecord.objects.create(
            weekly_plan=self.plan_2, day="sat", date=date(2026, 4, 4),
            attendance="present", required_verses=10, achieved_verses=6,
            recorded_by=self.teacher_user_2,
        )


class AttendanceReportAccessTests(ReportTestSetup):
    def test_teacher_attendance_report_is_scoped_to_own_students(self):
        """REP-01 / Feature 5.2: Teacher sees only own students."""
        self.client.force_authenticate(self.teacher_user_1)
        response = self.client.get("/api/reports/attendance/?month=4&year=2026")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["summary"]["total_records"], 1)
        self.assertEqual(len(response.data["data"]["students"]), 1)
        self.assertEqual(
            response.data["data"]["students"][0]["student_id"],
            str(self.student_1.id),
        )

    def test_teacher_cannot_request_another_teachers_attendance_report(self):
        """REP-02: Teacher A cannot view Teacher B's report."""
        self.client.force_authenticate(self.teacher_user_1)
        response = self.client.get(
            f"/api/reports/attendance/?month=4&year=2026&teacher={self.teacher_2.id}"
        )
        self.assertEqual(response.status_code, 403)

    def test_teacher_cannot_download_other_teachers_student_pdf(self):
        """REP-03 / Feature 5.5: Teacher A can't get Teacher B's student PDF."""
        self.client.force_authenticate(self.teacher_user_1)
        response = self.client.get(f"/api/reports/student/{self.student_2.id}/pdf/")
        self.assertEqual(response.status_code, 403)


class DashboardTests(ReportTestSetup):
    def test_dashboard_accessible_only_by_admin(self):
        """REP-04 / Feature 5.1: Teacher cannot access dashboard."""
        self.client.force_authenticate(self.teacher_user_1)
        response = self.client.get("/api/reports/dashboard/")
        self.assertEqual(response.status_code, 403)

    def test_dashboard_returns_correct_counts(self):
        """REP-05 / Feature 5.1: Dashboard shows correct student/teacher counts."""
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/reports/dashboard/")
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["total_students"], 2)
        self.assertEqual(data["total_teachers"], 2)


class AttendanceReportEdgeCases(ReportTestSetup):
    def test_attendance_report_with_no_data_returns_zeros(self):
        """REP-06: Empty month returns zeros, not errors."""
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/reports/attendance/?month=1&year=2025")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["summary"]["total_records"], 0)
        self.assertEqual(response.data["data"]["summary"]["attendance_rate"], 0)

    def test_invalid_month_year_params_return_400(self):
        """REP-10: Invalid month/year returns 400, not 500."""
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/reports/attendance/?month=abc&year=2026")
        self.assertEqual(response.status_code, 400)

        response2 = self.client.get("/api/reports/attendance/?month=13&year=2026")
        self.assertEqual(response2.status_code, 400)


class LeaderboardTests(ReportTestSetup):
    def test_leaderboard_returns_top_students_ordered(self):
        """REP-07 / Feature 5.4: Leaderboard ordered by achieved verses."""
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/reports/leaderboard/?month=4&year=2026")
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertTrue(len(data) <= 10)
        if len(data) >= 2:
            self.assertGreaterEqual(data[0]["total_achieved"], data[1]["total_achieved"])


class PDFReportTests(ReportTestSetup):
    def test_pdf_generation_returns_valid_pdf(self):
        """REP-08 / Feature 5.5: PDF bytes with correct content type."""
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/reports/student/{self.student_1.id}/pdf/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment", response["Content-Disposition"])


class StudentStatsTests(ReportTestSetup):
    def test_student_stats_returns_attendance_rate(self):
        """REP-09: Student stats includes attendance data."""
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/students/{self.student_1.id}/stats/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("data", response.data)
