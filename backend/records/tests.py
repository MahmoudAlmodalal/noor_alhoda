"""
Records & Weekly Plan Tests
Covers: FR-08, FR-12, FR-13, FR-14, FR-16, FR-17
"""
from datetime import date, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Parent, ParentStudentLink, Teacher, User
from notifications.models import Notification
from records.models import DailyRecord, WeeklyPlan
from students.models import Student


class RecordTestSetup(APITestCase):
    """Shared setup for record tests."""

    def setUp(self):
        self.admin = User.objects.create_user(
            phone_number="970590200000",
            password="adminpass", role="admin",
        )

        self.teacher_user = User.objects.create_user(
            phone_number="970590200010",
            password="secret123", role="teacher",
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user, full_name="Teacher Rec",
            session_days=["sat", "sun", "mon", "tue", "wed", "thu"],
        )

        self.teacher2_user = User.objects.create_user(
            phone_number="970590200011",
            password="secret123", role="teacher",
        )
        self.teacher2 = Teacher.objects.create(
            user=self.teacher2_user, full_name="Teacher 2 Rec",
        )

        self.parent_user = User.objects.create_user(
            phone_number="970590200020",
            password="secret123", role="parent",
        )
        self.parent = Parent.objects.create(
            user=self.parent_user, full_name="Parent Rec",
            phone_number="970590200020",
        )

        self.student_user = User.objects.create_user(
            phone_number="970590200030",
            password="secret123", role="student",
        )
        self.student = Student.objects.create(
            user=self.student_user, full_name="Student Rec",
            national_id="REC-001", birthdate=date(2012, 1, 1),
            grade="Grade 7", teacher=self.teacher,
        )
        ParentStudentLink.objects.create(parent=self.parent, student=self.student)

        # Student belonging to teacher2 (for cross-teacher tests)
        self.student2_user = User.objects.create_user(
            phone_number="970590200031",
            password="secret123", role="student",
        )
        self.student2 = Student.objects.create(
            user=self.student2_user, full_name="Student 2 Rec",
            national_id="REC-002", birthdate=date(2012, 2, 2),
            grade="Grade 8", teacher=self.teacher2,
        )

        self.plan = WeeklyPlan.objects.create(
            student=self.student, week_number=1,
            week_start=date(2026, 4, 4),
        )

        self.client.force_authenticate(self.teacher_user)


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
            weekly_plan=self.plan, day="mon", date=date(2026, 4, 6),
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

    def test_bulk_attendance_creates_weekly_plan_on_demand(self):
        """REC-05 / FR-12 + FR-13: Bulk attendance auto-creates WeeklyPlan."""
        # Delete existing plan to test auto-creation
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
        self.assertTrue(WeeklyPlan.objects.filter(student=self.student).exists())

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
