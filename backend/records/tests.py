"""
Records & Weekly Plan Tests
Covers: FR-08, FR-12, FR-13, FR-14, FR-16, FR-17
"""
from datetime import date, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Parent, ParentStudentLink, User
from teacher.models import Teacher
from notifications.models import Notification
from records.models import DailyRecord, WeeklyPlan
from students.models import Student


class RecordTestSetup(APITestCase):
    """Shared setup for record tests."""

    def setUp(self):
        self.admin = User.objects.create_user(
            national_id="970590200000",
            phone_number="970590200000",
            password="adminpass", role="admin",
        )

        self.teacher_user = User.objects.create_user(
            national_id="970590200010",
            phone_number="970590200010",
            password="secret123", role="teacher",
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user, full_name="Teacher Rec",
            session_days=["sat", "sun", "mon", "tue", "wed", "thu"],
        )

        self.teacher2_user = User.objects.create_user(
            national_id="970590200011",
            phone_number="970590200011",
            password="secret123", role="teacher",
        )
        self.teacher2 = Teacher.objects.create(
            user=self.teacher2_user, full_name="Teacher 2 Rec",
        )

        self.parent_user = User.objects.create_user(
            national_id="970590200020",
            phone_number="970590200020",
            password="secret123", role="parent",
        )
        self.parent = Parent.objects.create(
            user=self.parent_user, full_name="Parent Rec",
            phone_number="970590200020",
        )

        self.student_user = User.objects.create_user(
            national_id="970590200030",
            phone_number="970590200030",
            password="secret123", role="student",
        )
        self.student = Student.objects.create(
            user=self.student_user, full_name="Student Rec",
            birthdate=date(2012, 1, 1),
            grade="Grade 7", teacher=self.teacher,
        )
        ParentStudentLink.objects.create(parent=self.parent, student=self.student)

        # Student belonging to teacher2 (for cross-teacher tests)
        self.student2_user = User.objects.create_user(
            national_id="970590200031",
            phone_number="970590200031",
            password="secret123", role="student",
        )
        self.student2 = Student.objects.create(
            user=self.student2_user, full_name="Student 2 Rec",
            birthdate=date(2012, 2, 2),
            grade="Grade 8", teacher=self.teacher2,
        )

        self.plan = WeeklyPlan.objects.create(
            student=self.student, week_number=1,
            week_start=date(2026, 4, 4),
        )

        self.client.force_authenticate(self.teacher_user)


class WeeklyPlanLinesAndPagesTests(RecordTestSetup):
    def test_weekly_plan_lines_and_pages_calculation(self):
        """Test creating a weekly plan with total_required_lines and page calculations (15 lines = 1 page)."""
        response = self.client.post(
            "/api/records/weekly-plans/",
            {
                "student_id": str(self.student.id),
                "week_start": "2026-04-11",
                "total_required": 50,
                "total_required_lines": 30,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        plan_id = response.data["data"]["id"]
        plan = WeeklyPlan.objects.get(id=plan_id)
        self.assertEqual(plan.total_required_lines, 30)
        self.assertEqual(plan.total_required_pages, 2.0)

        # Create daily record with 15 memorized lines
        DailyRecord.objects.create(
            weekly_plan=plan,
            day="sat",
            date=date(2026, 4, 11),
            attendance="present",
            required_verses=10,
            achieved_verses=10,
            memorized_lines=15,
        )
        plan.refresh_from_db()
        self.assertEqual(plan.total_lines, 15)
        self.assertEqual(plan.total_pages, 1.0)


class AbsenceNotificationTests(RecordTestSetup):
    def test_absence_record_creation_creates_notification_and_updates_totals(self):
        """REC-01 / FR-14 + FR-17: Absence creates parent notification and updates weekly totals."""
        response = self.client.post(
            "/api/records/create/",
            {
                "weekly_plan_id": str(self.plan.id),
                "day": "sat", "date": "2026-04-04",
                "attendance": "absent",
                "required_verses": 10, "achieved_verses": 0,
                "quality": "none",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.total_required, 10)
        self.assertEqual(self.plan.total_achieved, 0)
        self.assertEqual(Notification.objects.filter(recipient=self.parent_user).count(), 1)

    def test_present_to_absent_update_triggers_notification(self):
        """REC-12: Changing present -> absent triggers notification."""
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="sun", date=timezone.now().date() - timedelta(days=1),
            attendance="present", recorded_by=self.teacher_user,
        )
        response = self.client.patch(
            f"/api/records/{record.id}/",
            {"attendance": "absent"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Notification.objects.filter(recipient=self.parent_user).count(), 1)

    def test_absent_to_absent_update_does_not_retrigger(self):
        """REC-13: Changing absent -> absent does NOT re-trigger notification."""
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="mon",
            date=timezone.now().date() - timedelta(days=1),
            attendance="absent", recorded_by=self.teacher_user,
        )
        # Clear any notification from creation
        Notification.objects.filter(recipient=self.parent_user).delete()

        response = self.client.patch(
            f"/api/records/{record.id}/",
            {"note": "still absent"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Notification.objects.filter(recipient=self.parent_user).count(), 0)


class EditRestrictionTests(RecordTestSetup):
    def test_teacher_cannot_update_record_older_than_seven_days(self):
        """REC-02 / FR-16: Teacher can't edit records >7 days old."""
        old_record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="sun",
            date=timezone.now().date() - timedelta(days=8),
            attendance="present", recorded_by=self.teacher_user,
        )
        response = self.client.patch(
            f"/api/records/{old_record.id}/",
            {"attendance": "absent"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_can_update_record_older_than_seven_days(self):
        """REC-04 / FR-16: Admin has no time restriction."""
        old_record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="tue",
            date=timezone.now().date() - timedelta(days=15),
            attendance="present", recorded_by=self.teacher_user,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/records/{old_record.id}/",
            {"attendance": "late"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)


class BulkAttendanceTests(RecordTestSetup):
    def test_bulk_attendance_rejects_friday(self):
        """REC-03 / FR-12: Friday is rejected."""
        response = self.client.post(
            "/api/records/bulk-attendance/",
            {
                "date": "2026-04-10",
                "records": [{"student_id": str(self.student.id), "attendance": "present"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_bulk_attendance_works_for_student_without_weekly_plan(self):
        """FR-12: Bulk attendance succeeds for student even if no WeeklyPlan exists."""
        # Delete existing plan to test no-plan attendance
        self.plan.delete()
        response = self.client.post(
            "/api/records/bulk-attendance/",
            {
                "date": "2026-04-04",
                "records": [{"student_id": str(self.student.id), "attendance": "present"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(WeeklyPlan.objects.filter(student=self.student).exists())
        self.assertEqual(len(response.json()["data"]["records"]), 1)
        self.assertEqual(response.json()["data"]["skipped"], [])

    def test_bulk_attendance_skips_other_teachers_students(self):
        """REC-06 / FR-08: Teacher can't record attendance for another teacher's student."""
        response = self.client.post(
            "/api/records/bulk-attendance/",
            {
                "date": "2026-04-04",
                "records": [
                    {"student_id": str(self.student.id), "attendance": "present"},
                    {"student_id": str(self.student2.id), "attendance": "present"},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        # Only teacher's own student should have a record
        records = DailyRecord.objects.filter(date=date(2026, 4, 4))
        student_ids = set(records.values_list("weekly_plan__student_id", flat=True))
        self.assertIn(self.student.id, student_ids)
        self.assertNotIn(self.student2.id, student_ids)

    def test_bulk_attendance_idempotent_update_or_create(self):
        """REC-14: Bulk attendance updates existing record, not duplicate."""
        self.client.post(
            "/api/records/bulk-attendance/",
            {
                "date": "2026-04-04",
                "records": [{"student_id": str(self.student.id), "attendance": "present"}],
            },
            format="json",
        )
        self.client.post(
            "/api/records/bulk-attendance/",
            {
                "date": "2026-04-04",
                "records": [{"student_id": str(self.student.id), "attendance": "absent"}],
            },
            format="json",
        )
        records = DailyRecord.objects.filter(
            weekly_plan__student=self.student, date=date(2026, 4, 4),
        )
        self.assertEqual(records.count(), 1)
        self.assertEqual(records.first().attendance, "absent")


class SignalAggregationTests(RecordTestSetup):
    def test_signal_recalculates_totals_after_record_save(self):
        """REC-07 / FR-14: Signal recalculates totals after each DailyRecord save."""
        DailyRecord.objects.create(
            weekly_plan=self.plan, day="sat", date=date(2026, 4, 4),
            attendance="present", required_verses=10, achieved_verses=7,
            recorded_by=self.teacher_user,
        )
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.total_required, 10)
        self.assertEqual(self.plan.total_achieved, 7)

        DailyRecord.objects.create(
            weekly_plan=self.plan, day="sun", date=date(2026, 4, 5),
            attendance="present", required_verses=8, achieved_verses=8,
            recorded_by=self.teacher_user,
        )
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.total_required, 18)
        self.assertEqual(self.plan.total_achieved, 15)

    def test_signal_recalculates_after_record_update(self):
        """REC-08 / FR-14: Signal recalculates correctly after record update."""
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="sat", date=date(2026, 4, 4),
            attendance="present", required_verses=10, achieved_verses=5,
            recorded_by=self.teacher_user,
        )
        record.achieved_verses = 10
        record.save()
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.total_achieved, 10)


class ResultInferenceTests(RecordTestSetup):
    """REC-21: post_save signal infers DailyRecord.result from achieved/required."""

    def test_present_high_ratio_becomes_pass(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="sat", date=date(2026, 4, 4),
            attendance="present", required_verses=10, achieved_verses=9,
            recorded_by=self.teacher_user,
        )
        record.refresh_from_db()
        self.assertEqual(record.result, DailyRecord.Result.PASS)

    def test_present_threshold_boundary_is_pass(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="sun", date=date(2026, 4, 5),
            attendance="present", required_verses=10, achieved_verses=8,
            recorded_by=self.teacher_user,
        )
        record.refresh_from_db()
        # 8/10 = 0.8 == threshold → pass
        self.assertEqual(record.result, DailyRecord.Result.PASS)

    def test_present_low_ratio_becomes_fail(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="mon", date=date(2026, 4, 6),
            attendance="present", required_verses=10, achieved_verses=5,
            recorded_by=self.teacher_user,
        )
        record.refresh_from_db()
        self.assertEqual(record.result, DailyRecord.Result.FAIL)

    def test_late_ratio_inferred_same_as_present(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="tue", date=date(2026, 4, 7),
            attendance="late", required_verses=10, achieved_verses=9,
            recorded_by=self.teacher_user,
        )
        record.refresh_from_db()
        self.assertEqual(record.result, DailyRecord.Result.PASS)

    def test_explicit_pass_not_overridden(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="wed", date=date(2026, 4, 8),
            attendance="present", required_verses=10, achieved_verses=2,
            result="pass",
            recorded_by=self.teacher_user,
        )
        record.refresh_from_db()
        self.assertEqual(record.result, DailyRecord.Result.PASS)

    def test_explicit_fail_not_overridden(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="thu", date=date(2026, 4, 9),
            attendance="present", required_verses=10, achieved_verses=10,
            result="fail",
            recorded_by=self.teacher_user,
        )
        record.refresh_from_db()
        self.assertEqual(record.result, DailyRecord.Result.FAIL)

    def test_zero_required_stays_pending(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="sat", date=date(2026, 4, 4),
            attendance="present", required_verses=0, achieved_verses=0,
            recorded_by=self.teacher_user,
        )
        record.refresh_from_db()
        self.assertEqual(record.result, DailyRecord.Result.PENDING)

    def test_absent_stays_pending_even_with_target(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="sun", date=date(2026, 4, 5),
            attendance="absent", required_verses=10, achieved_verses=0,
            recorded_by=self.teacher_user,
        )
        record.refresh_from_db()
        self.assertEqual(record.result, DailyRecord.Result.PENDING)

    def test_excused_stays_pending(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="mon", date=date(2026, 4, 6),
            attendance="excused", required_verses=10, achieved_verses=0,
            recorded_by=self.teacher_user,
        )
        record.refresh_from_db()
        self.assertEqual(record.result, DailyRecord.Result.PENDING)

    def test_update_recomputes_when_result_pending(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="tue", date=date(2026, 4, 7),
            attendance="present", required_verses=10, achieved_verses=2,
            recorded_by=self.teacher_user,
        )
        record.refresh_from_db()
        self.assertEqual(record.result, DailyRecord.Result.FAIL)
        # Reset to pending and bump achieved — re-inference should flip to pass.
        record.result = DailyRecord.Result.PENDING
        record.achieved_verses = 9
        record.save()
        record.refresh_from_db()
        self.assertEqual(record.result, DailyRecord.Result.PASS)

    def test_in_memory_instance_updated_at_synced(self):
        record = DailyRecord.objects.create(
            weekly_plan=self.plan, day="wed", date=date(2026, 4, 8),
            attendance="present", required_verses=10, achieved_verses=9,
            recorded_by=self.teacher_user,
        )
        self.assertIsNotNone(record.updated_at)
        db_record = DailyRecord.objects.get(pk=record.pk)
        self.assertEqual(record.updated_at, db_record.updated_at)



class TeacherOwnershipTests(RecordTestSetup):
    def test_teacher_cannot_create_record_for_another_teachers_student(self):
        """REC-09 / FR-08: Teacher can't create record for other teacher's student."""
        plan2 = WeeklyPlan.objects.create(
            student=self.student2, week_number=1, week_start=date(2026, 4, 4),
        )
        response = self.client.post(
            "/api/records/create/",
            {
                "weekly_plan_id": str(plan2.id),
                "day": "sat", "date": "2026-04-04",
                "attendance": "present",
                "required_verses": 5, "achieved_verses": 5,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_duplicate_weekly_plan_rejected(self):
        """REC-10: Creating WeeklyPlan with duplicate week_start fails."""
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            "/api/records/weekly-plans/",
            {
                "student_id": str(self.student.id),
                "week_start": "2026-04-04",
                "week_number": 2,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


# ==========================================================================
# Extended coverage — plan: endpoint matrix for /api/records/
# ==========================================================================
import uuid


RECORDS_URL = "/api/records/"
RECORDS_CREATE_URL = "/api/records/create/"
BULK_ATTENDANCE_URL = "/api/records/bulk-attendance/"
WEEKLY_SUMMARY_URL = "/api/records/weekly-summary/"
WEEKLY_PLANS_URL = "/api/records/weekly-plans/"


class DailyRecordListTests(RecordTestSetup):
    def test_missing_date_returns_400(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.get(RECORDS_URL)
        self.assertEqual(response.status_code, 400)

    def test_teacher_sees_only_own_students_records(self):
        DailyRecord.objects.create(
            weekly_plan=self.plan, day="sat", date=date(2026, 4, 4),
            attendance="present", recorded_by=self.teacher_user,
        )
        plan2 = WeeklyPlan.objects.create(
            student=self.student2, week_number=1, week_start=date(2026, 4, 4),
        )
        DailyRecord.objects.create(
            weekly_plan=plan2, day="sat", date=date(2026, 4, 4),
            attendance="present", recorded_by=self.teacher2_user,
        )
        self.client.force_authenticate(self.teacher_user)
        response = self.client.get(RECORDS_URL + "?date=2026-04-04")
        self.assertEqual(response.status_code, 200)
        student_ids = {row["student_id"] for row in response.data["data"]}
        self.assertIn(str(self.student.id), student_ids)
        self.assertNotIn(str(self.student2.id), student_ids)

    def test_admin_sees_all_records(self):
        DailyRecord.objects.create(
            weekly_plan=self.plan, day="sat", date=date(2026, 4, 4),
            attendance="present", recorded_by=self.teacher_user,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.get(RECORDS_URL + "?date=2026-04-04")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data["data"]), 1)

    def test_student_cannot_list_records(self):
        self.client.force_authenticate(self.student_user)
        response = self.client.get(RECORDS_URL + "?date=2026-04-04")
        self.assertEqual(response.status_code, 403)

    def test_parent_cannot_list_records(self):
        self.client.force_authenticate(self.parent_user)
        response = self.client.get(RECORDS_URL + "?date=2026-04-04")
        self.assertEqual(response.status_code, 403)


class DailyRecordCreateValidationTests(RecordTestSetup):
    def test_invalid_weekly_plan_id_returns_error(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            RECORDS_CREATE_URL,
            {
                "weekly_plan_id": str(uuid.uuid4()),
                "day": "sat",
                "date": "2026-04-04",
                "attendance": "present",
            },
            format="json",
        )
        self.assertIn(response.status_code, (400, 404))

    def test_invalid_day_choice_rejected(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            RECORDS_CREATE_URL,
            {
                "weekly_plan_id": str(self.plan.id),
                "day": "fri",
                "date": "2026-04-04",
                "attendance": "present",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_attendance_choice_rejected(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            RECORDS_CREATE_URL,
            {
                "weekly_plan_id": str(self.plan.id),
                "day": "sat",
                "date": "2026-04-04",
                "attendance": "unknown",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_quality_choice_rejected(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            RECORDS_CREATE_URL,
            {
                "weekly_plan_id": str(self.plan.id),
                "day": "sat",
                "date": "2026-04-04",
                "attendance": "present",
                "quality": "banger",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class DailyRecordPatchTests(RecordTestSetup):
    def test_missing_record_returns_404(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.patch(
            f"{RECORDS_URL}{uuid.uuid4()}/",
            {"attendance": "late"},
            format="json",
        )
        self.assertIn(response.status_code, (400, 404))

    def test_teacher_cannot_patch_other_teachers_record(self):
        plan2 = WeeklyPlan.objects.create(
            student=self.student2, week_number=1, week_start=date(2026, 4, 4),
        )
        record2 = DailyRecord.objects.create(
            weekly_plan=plan2, day="sat", date=date(2026, 4, 4),
            attendance="present", recorded_by=self.teacher2_user,
        )
        self.client.force_authenticate(self.teacher_user)
        response = self.client.patch(
            f"{RECORDS_URL}{record2.id}/",
            {"attendance": "late"},
            format="json",
        )
        self.assertIn(response.status_code, (403, 404))


class BulkAttendanceExtendedTests(RecordTestSetup):
    def test_present_bulk_does_not_create_notifications(self):
        self.client.force_authenticate(self.teacher_user)
        self.client.post(
            BULK_ATTENDANCE_URL,
            {
                "date": "2026-04-04",
                "records": [{"student_id": str(self.student.id), "attendance": "present"}],
            },
            format="json",
        )
        self.assertEqual(
            Notification.objects.filter(recipient=self.parent_user).count(), 0
        )

    def test_absent_bulk_creates_notifications(self):
        self.client.force_authenticate(self.teacher_user)
        self.client.post(
            BULK_ATTENDANCE_URL,
            {
                "date": "2026-04-04",
                "records": [{"student_id": str(self.student.id), "attendance": "absent"}],
            },
            format="json",
        )
        self.assertEqual(
            Notification.objects.filter(recipient=self.parent_user).count(), 1
        )

    def test_bulk_skips_unknown_student_id(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            BULK_ATTENDANCE_URL,
            {
                "date": "2026-04-04",
                "records": [
                    {"student_id": str(uuid.uuid4()), "attendance": "present"},
                    {"student_id": str(self.student.id), "attendance": "present"},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        records = DailyRecord.objects.filter(
            weekly_plan__student=self.student, date=date(2026, 4, 4)
        )
        self.assertEqual(records.count(), 1)


class WeeklySummaryTests(RecordTestSetup):
    def test_missing_week_start_returns_400(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.get(f"{WEEKLY_SUMMARY_URL}{self.student.id}/")
        self.assertEqual(response.status_code, 400)

    def test_unauthorized_access_returns_403(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.get(
            f"{WEEKLY_SUMMARY_URL}{self.student2.id}/?week_start=2026-04-04"
        )
        self.assertEqual(response.status_code, 403)

    def test_authorized_no_plan_returns_zero_state(self):
        plan_only_student = Student.objects.create(
            user=User.objects.create_user(
                national_id="970590200099",
                phone_number="970590200099",
                password="s",
                role="student",
            ),
            full_name="Plain",
            birthdate=date(2012, 1, 1),
            grade="G5",
            teacher=self.teacher,
        )
        self.client.force_authenticate(self.teacher_user)
        response = self.client.get(
            f"{WEEKLY_SUMMARY_URL}{plan_only_student.id}/?week_start=2030-01-04"
        )
        self.assertEqual(response.status_code, 200)

    def test_authorized_with_records_returns_daily_grid(self):
        DailyRecord.objects.create(
            weekly_plan=self.plan, day="sat", date=date(2026, 4, 4),
            attendance="present", required_verses=5, achieved_verses=5,
            recorded_by=self.teacher_user,
        )
        self.client.force_authenticate(self.teacher_user)
        response = self.client.get(
            f"{WEEKLY_SUMMARY_URL}{self.student.id}/?week_start=2026-04-04"
        )
        self.assertEqual(response.status_code, 200)


class WeeklyPlanListTests(RecordTestSetup):
    def test_admin_sees_all_plans(self):
        WeeklyPlan.objects.create(
            student=self.student2, week_number=1, week_start=date(2026, 4, 4),
        )
        self.client.force_authenticate(self.admin)
        response = self.client.get(WEEKLY_PLANS_URL)
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data["data"]), 2)

    def test_teacher_sees_only_own_plans(self):
        WeeklyPlan.objects.create(
            student=self.student2, week_number=1, week_start=date(2026, 4, 4),
        )
        self.client.force_authenticate(self.teacher_user)
        response = self.client.get(WEEKLY_PLANS_URL)
        self.assertEqual(response.status_code, 200)
        for row in response.data["data"]:
            self.assertEqual(
                row.get("student_id") or row.get("student", {}).get("id"),
                str(self.student.id),
            )

    def test_student_cannot_list_plans(self):
        self.client.force_authenticate(self.student_user)
        response = self.client.get(WEEKLY_PLANS_URL)
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(WEEKLY_PLANS_URL)
        self.assertEqual(response.status_code, 401)


class WeeklyPlanCreateExtendedTests(RecordTestSetup):
    def test_invalid_student_id_returns_400(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            WEEKLY_PLANS_URL,
            {
                "student_id": str(uuid.uuid4()),
                "week_start": "2026-05-02",
            },
            format="json",
        )
        self.assertIn(response.status_code, (400, 404))

    def test_teacher_cannot_create_plan_for_other_teachers_student(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            WEEKLY_PLANS_URL,
            {
                "student_id": str(self.student2.id),
                "week_start": "2026-05-02",
            },
            format="json",
        )
        self.assertIn(response.status_code, (400, 403))

    def test_week_number_defaulted_when_omitted(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            WEEKLY_PLANS_URL,
            {
                "student_id": str(self.student.id),
                "week_start": "2026-05-02",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(response.data["data"]["week_number"])


class DailyRecordWithoutPlanTests(RecordTestSetup):
    """Tests for DailyRecord without a WeeklyPlan (the core new feature)."""

    def test_create_attendance_without_plan(self):
        """Test 1: Attendance can be created without a weekly plan."""
        response = self.client.post(
            "/api/records/create/",
            {
                "student_id": str(self.student.id),
                "weekly_plan_id": None,
                "day": "sat",
                "date": "2026-05-02",
                "attendance": "present",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()["data"]
        self.assertEqual(data["student_id"], str(self.student.id))
        self.assertIsNone(data["weekly_plan_id"])

    def test_create_absent_without_plan(self):
        """Test 2: Absent can be recorded without a weekly plan."""
        response = self.client.post(
            "/api/records/create/",
            {
                "student_id": str(self.student.id),
                "weekly_plan_id": None,
                "day": "sun",
                "date": "2026-05-03",
                "attendance": "absent",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_create_recitation_without_plan(self):
        """Test 3: Full recitation data can be saved without a weekly plan."""
        response = self.client.post(
            "/api/records/create/",
            {
                "student_id": str(self.student.id),
                "weekly_plan_id": None,
                "day": "mon",
                "date": "2026-05-04",
                "attendance": "present",
                "surah_name": "يس",
                "from_ayah": 1,
                "to_ayah": 12,
                "quality": "good",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()["data"]
        self.assertEqual(data["surah_name"], "يس")
        self.assertEqual(data["from_ayah"], 1)
        self.assertEqual(data["to_ayah"], 12)
        self.assertIsNone(data["weekly_plan_id"])

    def test_create_review_without_plan(self):
        """Test 4: Review data can be saved without a weekly plan."""
        response = self.client.post(
            "/api/records/create/",
            {
                "student_id": str(self.student.id),
                "weekly_plan_id": None,
                "day": "tue",
                "date": "2026-05-05",
                "attendance": "present",
                "review_surah_name": "الفاتحة",
                "review_from_ayah": 1,
                "review_to_ayah": 7,
                "review_quality": "excellent",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()["data"]
        self.assertEqual(data["review_surah_name"], "الفاتحة")

    def test_save_twice_same_student_date(self):
        """Test 7: Saving twice for same student+date updates the record."""
        today_str = str(timezone.now().date())
        response = self.client.post(
            "/api/records/create/",
            {
                "student_id": str(self.student.id),
                "day": "sat",
                "date": today_str,
                "attendance": "present",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        record_id = response.json()["data"]["id"]

        response2 = self.client.patch(
            f"/api/records/{record_id}/",
            {"attendance": "absent"},
            format="json",
        )
        self.assertEqual(response2.status_code, 200)
        count = DailyRecord.objects.filter(student=self.student, date=today_str).count()
        self.assertEqual(count, 1)

    def test_plan_statistics_not_updated_when_no_plan(self):
        """Test 10: No WeeklyPlan statistics are updated when plan is None."""
        record = DailyRecord.objects.create(
            student=self.student,
            weekly_plan=None,
            day="sat",
            date="2026-07-01",
            attendance="present",
            required_verses=10,
            achieved_verses=10,
        )
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.total_achieved, 0)
        self.assertEqual(self.plan.total_required, 0)

    def test_teacher_cannot_create_record_for_unowned_student(self):
        """Test 11: Teacher cannot create records for another teacher's student."""
        response = self.client.post(
            "/api/records/create/",
            {
                "student_id": str(self.student2.id),
                "day": "sat",
                "date": "2026-07-02",
                "attendance": "present",
            },
            format="json",
        )
        self.assertIn(response.status_code, [403, 400, 404])

    def test_historical_migration_student_field(self):
        """Test 9: DailyRecord with weekly_plan has student set correctly."""
        record = DailyRecord.objects.create(
            student=self.student,
            weekly_plan=self.plan,
            day="sat",
            date="2026-08-01",
            attendance="present",
        )
        self.assertEqual(record.student, self.student)
        self.assertEqual(record.weekly_plan, self.plan)
        self.assertEqual(record.student, self.plan.student)

    def test_actual_exceeds_plan(self):
        """Test 5: Teacher can save recitation exceeding the plan."""
        self.plan.total_required = 5
        self.plan.save()
        response = self.client.post(
            "/api/records/create/",
            {
                "student_id": str(self.student.id),
                "weekly_plan_id": str(self.plan.id),
                "day": "sat",
                "date": "2026-04-04",
                "attendance": "present",
                "from_ayah": 1,
                "to_ayah": 10,
                "required_verses": 5,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()["data"]
        self.assertEqual(data["from_ayah"], 1)
        self.assertEqual(data["to_ayah"], 10)
        self.assertEqual(data["achieved_verses"], 10)

