"""
Report Tests
Covers: Features 5.1-5.5
"""
from datetime import date

from rest_framework.test import APITestCase

from accounts.models import User
from teacher.models import Teacher
from records.models import DailyRecord, WeeklyPlan
from reports.selectors.report_selectors import attendance_summary_for_report
from reports.services.report_services import _ar
from students.models import Student


class ReportTestSetup(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            national_id="970590400000",
            phone_number="970590400000",
            password="adminpass", role="admin",
        )

        self.teacher_user_1 = User.objects.create_user(
            national_id="970590400010",
            phone_number="970590400010",
            password="secret123", role="teacher",
        )
        self.teacher_1 = Teacher.objects.create(
            user=self.teacher_user_1, full_name="Teacher Rep 1",
        )

        self.teacher_user_2 = User.objects.create_user(
            national_id="970590400020",
            phone_number="970590400020",
            password="secret123", role="teacher",
        )
        self.teacher_2 = Teacher.objects.create(
            user=self.teacher_user_2, full_name="Teacher Rep 2",
        )

        self.student_user_1 = User.objects.create_user(
            national_id="970590400030",
            phone_number="970590400030",
            password="secret123", role="student",
        )
        self.student_1 = Student.objects.create(
            user=self.student_user_1, full_name="Student Rep 1",
            birthdate=date(2011, 1, 1),
            grade="Grade 8", teacher=self.teacher_1,
        )

        self.student_user_2 = User.objects.create_user(
            national_id="970590400040",
            phone_number="970590400040",
            password="secret123", role="student",
        )
        self.student_2 = Student.objects.create(
            user=self.student_user_2, full_name="Student Rep 2",
            birthdate=date(2011, 2, 2),
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

    def create_daily_record(
        self,
        *,
        student=None,
        attendance=DailyRecord.Attendance.PRESENT,
        record_date=date(2026, 4, 5),
        weekly_plan=None,
        recorded_by=None,
    ):
        return DailyRecord.objects.create(
            student=student or self.student_1,
            weekly_plan=weekly_plan,
            day="sat",
            date=record_date,
            attendance=attendance,
            recorded_by=recorded_by or self.teacher_user_1,
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
        """REP-07 / Feature 5.4: Leaderboard ordered by combined score (verses + attendance)."""
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/reports/leaderboard/?month=4&year=2026")
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertTrue(len(data) <= 10)
        if len(data) >= 2:
            self.assertGreaterEqual(data[0]["score"], data[1]["score"])


class PDFReportTests(ReportTestSetup):
    def test_pdf_generation_returns_valid_pdf(self):
        """REP-08 / Feature 5.5: PDF bytes with correct content type."""
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/reports/student/{self.student_1.id}/pdf/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment", response["Content-Disposition"])


class StudentPDFReportAttendanceTests(ReportTestSetup):
    def test_attendance_summary_counts_statuses_and_records_without_a_plan(self):
        self.create_daily_record(
            attendance=DailyRecord.Attendance.LATE,
            record_date=date(2026, 4, 5),
            weekly_plan=self.plan_1,
        )
        self.create_daily_record(
            attendance=DailyRecord.Attendance.ABSENT,
            record_date=date(2026, 4, 6),
            weekly_plan=self.plan_1,
        )
        self.create_daily_record(
            attendance=DailyRecord.Attendance.EXCUSED,
            record_date=date(2026, 4, 7),
            weekly_plan=self.plan_1,
        )
        self.create_daily_record(
            attendance=DailyRecord.Attendance.PRESENT,
            record_date=date(2026, 4, 8),
        )

        with self.assertNumQueries(1):
            summary = attendance_summary_for_report(student=self.student_1)

        self.assertEqual(summary, {"present_days": 3, "absent_days": 1})

    def test_pdf_contains_only_allowed_identity_fields_and_attendance_summary(self):
        self.student_user_1.national_id = ""
        self.student_user_1.save(update_fields=["national_id"])
        self.create_daily_record(
            attendance=DailyRecord.Attendance.LATE,
            record_date=date(2026, 4, 5),
            weekly_plan=self.plan_1,
        )
        self.create_daily_record(
            attendance=DailyRecord.Attendance.ABSENT,
            record_date=date(2026, 4, 6),
            weekly_plan=self.plan_1,
        )

        from unittest.mock import patch
        from reportlab.platypus import Table as ReportLabTable

        with patch("reportlab.platypus.Table", side_effect=ReportLabTable) as table_factory:
            self.client.force_authenticate(self.admin)
            response = self.client.get(f"{STUDENT_PDF_URL}{self.student_1.id}/pdf/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF-"))
        self.assertGreater(len(response.content), 0)

        table_data = [call.args[0] for call in table_factory.call_args_list]
        info_data = next(
            data for data in table_data
            if [row[0] for row in data] == [_ar("الاسم"), _ar("رقم الهوية")]
        )
        self.assertEqual(
            [row[0] for row in info_data],
            [_ar("الاسم"), _ar("رقم الهوية")],
        )
        self.assertEqual(info_data[1][1], _ar("غير متوفر"))

        attendance_data = next(
            data for data in table_data
            if [row[0] for row in data] == [_ar("أيام الحضور"), _ar("أيام الغياب")]
        )
        self.assertEqual(
            [row[0] for row in attendance_data],
            [_ar("أيام الحضور"), _ar("أيام الغياب")],
        )
        self.assertEqual(attendance_data[0][1], "2")
        self.assertEqual(attendance_data[1][1], "1")

        plan_data = next(data for data in table_data if data[0][0] == _ar("الأسبوع"))
        self.assertEqual(plan_data[0][0], _ar("الأسبوع"))
        self.assertEqual(plan_data[1][0], "1")

    def test_pdf_with_missing_attendance_and_plans_has_zeroes_and_empty_state(self):
        user = User.objects.create_user(
            national_id="970590400050",
            phone_number="970590400050",
            password="secret123",
            role="student",
        )
        user.national_id = ""
        user.save(update_fields=["national_id"])
        student = Student.objects.create(
            user=user,
            full_name="Student Without Records",
            birthdate=date(2012, 3, 3),
            grade="Grade 7",
        )

        from unittest.mock import patch
        from reportlab.platypus import Paragraph as ReportLabParagraph
        from reportlab.platypus import Table as ReportLabTable

        with (
            patch("reportlab.platypus.Table", side_effect=ReportLabTable) as table_factory,
            patch("reportlab.platypus.Paragraph", side_effect=ReportLabParagraph) as paragraph_factory,
        ):
            self.client.force_authenticate(self.admin)
            response = self.client.get(f"{STUDENT_PDF_URL}{student.id}/pdf/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF-"))
        table_data = [call.args[0] for call in table_factory.call_args_list]
        attendance_data = next(
            data for data in table_data
            if [row[0] for row in data] == [_ar("أيام الحضور"), _ar("أيام الغياب")]
        )
        self.assertEqual(attendance_data[0][1], "0")
        self.assertEqual(attendance_data[1][1], "0")
        paragraph_texts = [call.args[0] for call in paragraph_factory.call_args_list]
        self.assertIn(_ar("لا توجد سجلات حفظية بعد."), paragraph_texts)


class StudentStatsTests(ReportTestSetup):
    def test_student_stats_returns_attendance_rate(self):
        """REP-09: Student stats includes attendance data."""
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/students/{self.student_1.id}/stats/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("data", response.data)


# ==========================================================================
# Extended coverage — plan: endpoint matrix for /api/reports/
# ==========================================================================
import uuid

from accounts.models import Parent, ParentStudentLink


DASHBOARD_URL = "/api/reports/dashboard/"
ATTENDANCE_URL = "/api/reports/attendance/"
LEADERBOARD_URL = "/api/reports/leaderboard/"
STUDENT_PDF_URL = "/api/reports/student/"


class DashboardExtendedTests(ReportTestSetup):
    def test_student_cannot_access_dashboard(self):
        self.client.force_authenticate(self.student_user_1)
        response = self.client.get(DASHBOARD_URL)
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_dashboard_returns_401(self):
        response = self.client.get(DASHBOARD_URL)
        self.assertEqual(response.status_code, 401)

    def test_dashboard_success_envelope(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(DASHBOARD_URL)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])


class AttendanceReportExtendedTests(ReportTestSetup):
    def test_admin_gets_all_students(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(ATTENDANCE_URL + "?month=4&year=2026")
        self.assertEqual(response.status_code, 200)
        students = response.data["data"]["students"]
        self.assertEqual(len(students), 2)

    def test_unauthenticated_returns_401(self):
        response = self.client.get(ATTENDANCE_URL + "?month=4&year=2026")
        self.assertEqual(response.status_code, 401)

    def test_missing_month_param_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(ATTENDANCE_URL + "?year=2026")
        self.assertEqual(response.status_code, 400)


class StudentPDFExtendedTests(ReportTestSetup):
    def test_teacher_own_student_pdf_success(self):
        self.client.force_authenticate(self.teacher_user_1)
        response = self.client.get(f"{STUDENT_PDF_URL}{self.student_1.id}/pdf/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")

    def test_pdf_bytes_start_with_magic_header(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{STUDENT_PDF_URL}{self.student_1.id}/pdf/")
        self.assertTrue(response.content.startswith(b"%PDF-"))

    def test_missing_student_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{STUDENT_PDF_URL}{uuid.uuid4()}/pdf/")
        self.assertEqual(response.status_code, 404)


class LeaderboardExtendedTests(ReportTestSetup):
    def test_no_params_required(self):
        """REP-EXT: Leaderboard works without any query params (uses current week)."""
        self.client.force_authenticate(self.admin)
        response = self.client.get(LEADERBOARD_URL)
        self.assertEqual(response.status_code, 200)
        self.assertIn("data", response.data)

    def test_student_can_access_leaderboard(self):
        self.client.force_authenticate(self.student_user_1)
        response = self.client.get(LEADERBOARD_URL)
        self.assertEqual(response.status_code, 200)

    def test_parent_can_access_leaderboard(self):
        parent_user = User.objects.create_user(
            national_id="970590400099",
            phone_number="970590400099",
            password="p",
            role="parent",
        )
        Parent.objects.create(user=parent_user, full_name="P")
        self.client.force_authenticate(parent_user)
        response = self.client.get(LEADERBOARD_URL)
        self.assertEqual(response.status_code, 200)

    def test_leaderboard_descending_order(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(LEADERBOARD_URL)
        data = response.data["data"]
        scores = [row["score"] for row in data]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_leaderboard_caps_at_ten_entries(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(LEADERBOARD_URL)
        self.assertLessEqual(len(response.data["data"]), 10)

    def test_unauthenticated_returns_401(self):
        response = self.client.get(LEADERBOARD_URL)
        self.assertEqual(response.status_code, 401)
