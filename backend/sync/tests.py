"""Sync service tests."""

from datetime import date
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APITestCase

from accounts.models import Parent, ParentStudentLink, User
from evaluations.models import Evaluation
from notifications.models import Notification
from records.models import DailyRecord, ReviewRecord, WeeklyPlan
from students.models import Student
from sync.services.push_services import _conflict_row
from sync.services.resource_dicts import RESOURCE_DICT_MAP
from teacher.models import Teacher


class ConflictRowResourceTagTests(TestCase):
    """The frontend (`src/lib/sync/push.ts` `applyServerRow`) dispatches
    server-authoritative push rows to the correct local table by reading
    the `_resource` tag on the row. Without this tag, the push result
    cannot emit a change event and UIs stay stale after conflicts."""

    def test_every_registered_resource_gets_tag(self):
        for resource_name, (model_cls, _to_dict) in RESOURCE_DICT_MAP.items():
            # Swap in a stub serializer so this test doesn't need DB fixtures.
            stub_map = {**RESOURCE_DICT_MAP}
            stub_map[resource_name] = (model_cls, lambda _instance: {"id": "x"})
            with patch.dict(
                "sync.services.push_services.RESOURCE_DICT_MAP",
                stub_map,
                clear=True,
            ):
                row = _conflict_row(resource_name, object())
            self.assertEqual(
                row.get("_resource"),
                resource_name,
                msg=f"_resource tag missing or wrong on '{resource_name}'",
            )


class SyncPullRBACSetup(APITestCase):
    """
    Two teachers, two students each, one parent linked to one of teacher A's
    students. Each visible student has a WeeklyPlan + DailyRecord + Review
    + Evaluation. Each user has a self-recipient notification. Used to prove
    that `/api/sync/pull/` returns exactly the rows each role is permitted
    to see.
    """

    def setUp(self):
        # --- users / profiles ----------------------------------------------
        self.admin = User.objects.create_user(
            national_id="ADM-001", phone_number="970599000000",
            password="adminpass", role="admin",
        )

        self.teacher_a_user = User.objects.create_user(
            national_id="TEA-A", phone_number="970599000010",
            password="pw", role="teacher",
        )
        self.teacher_a = Teacher.objects.create(
            user=self.teacher_a_user, full_name="Teacher A", max_students=25,
        )

        self.teacher_b_user = User.objects.create_user(
            national_id="TEA-B", phone_number="970599000020",
            password="pw", role="teacher",
        )
        self.teacher_b = Teacher.objects.create(
            user=self.teacher_b_user, full_name="Teacher B", max_students=25,
        )

        self.student_a1_user = User.objects.create_user(
            national_id="S-A1", phone_number="970599000030",
            password="pw", role="student",
        )
        self.student_a1 = Student.objects.create(
            user=self.student_a1_user, full_name="Student A1",
            birthdate=date(2012, 1, 1), grade="G7", teacher=self.teacher_a,
            guardian_name="GA1", guardian_mobile="970599000031",
        )

        self.student_a2_user = User.objects.create_user(
            national_id="S-A2", phone_number="970599000040",
            password="pw", role="student",
        )
        self.student_a2 = Student.objects.create(
            user=self.student_a2_user, full_name="Student A2",
            birthdate=date(2012, 2, 2), grade="G7", teacher=self.teacher_a,
            guardian_name="GA2", guardian_mobile="970599000041",
        )

        self.student_b1_user = User.objects.create_user(
            national_id="S-B1", phone_number="970599000050",
            password="pw", role="student",
        )
        self.student_b1 = Student.objects.create(
            user=self.student_b1_user, full_name="Student B1",
            birthdate=date(2012, 3, 3), grade="G8", teacher=self.teacher_b,
            guardian_name="GB1", guardian_mobile="970599000051",
        )

        self.student_b2_user = User.objects.create_user(
            national_id="S-B2", phone_number="970599000060",
            password="pw", role="student",
        )
        self.student_b2 = Student.objects.create(
            user=self.student_b2_user, full_name="Student B2",
            birthdate=date(2012, 4, 4), grade="G8", teacher=self.teacher_b,
            guardian_name="GB2", guardian_mobile="970599000061",
        )

        self.parent_user = User.objects.create_user(
            national_id="PAR-1", phone_number="970599000070",
            password="pw", role="parent",
        )
        self.parent = Parent.objects.create(
            user=self.parent_user, full_name="Parent 1",
            phone_number="970599000070",
        )
        ParentStudentLink.objects.create(
            parent=self.parent, student=self.student_a1,
        )

        # --- per-student records (one of each table) -----------------------
        for idx, student in enumerate(
            [self.student_a1, self.student_a2, self.student_b1, self.student_b2]
        ):
            plan = WeeklyPlan.objects.create(
                student=student, week_number=1,
                week_start=date(2026, 1, 3 + idx),
            )
            DailyRecord.objects.create(
                weekly_plan=plan, day="sat", date=plan.week_start,
            )
            ReviewRecord.objects.create(
                student=student, surah_name=f"Surah {idx}",
                reviewed_date=plan.week_start,
            )
            Evaluation.objects.create(
                student=student, title=f"Eval {idx}",
                surah_range="Al-Fatiha", scheduled_date=plan.week_start,
            )

        # --- one notification per user (recipient = self) ------------------
        for u in [
            self.admin, self.teacher_a_user, self.teacher_b_user,
            self.student_a1_user, self.student_a2_user,
            self.student_b1_user, self.student_b2_user, self.parent_user,
        ]:
            Notification.objects.create(
                recipient=u, type="announcement",
                title="hi", body="hello",
            )

    # ------------------------------------------------------------------ utils
    def _pull(self):
        response = self.client.get("/api/sync/pull/")
        self.assertEqual(response.status_code, 200)
        return response.json()["data"]["resources"]

    def _ids(self, rows, key="id"):
        return {r[key] for r in rows}


class SyncPullAdminTests(SyncPullRBACSetup):
    def test_admin_pulls_every_table_in_full(self):
        """Admin's local DB must mirror the entire server — across every
        table in the pull manifest."""
        self.client.force_authenticate(self.admin)
        res = self._pull()

        self.assertEqual(len(res["students"]), 4)
        self.assertEqual(len(res["teachers"]), 2)
        self.assertEqual(len(res["parents"]), 1)
        self.assertEqual(len(res["parent_student_links"]), 1)
        self.assertEqual(len(res["weekly_plans"]), 4)
        self.assertEqual(len(res["daily_records"]), 4)
        self.assertEqual(len(res["review_records"]), 4)
        self.assertEqual(len(res["evaluations"]), 4)
        # All 8 user records (admin + 2 teachers + 4 students + 1 parent).
        self.assertEqual(len(res["users"]), 8)
        # Admin sees only their own notification, by recipient filter.
        # This is intentional: notifications are personal, not shared
        # like roster data.
        self.assertEqual(len(res["notifications"]), 1)


class SyncPullTeacherTests(SyncPullRBACSetup):
    def test_teacher_pulls_only_own_scope(self):
        """Teacher A's local DB must contain A's two students, A's plans/
        records/evaluations, and only A's own teacher row — never B's
        data."""
        self.client.force_authenticate(self.teacher_a_user)
        res = self._pull()

        student_ids = self._ids(res["students"])
        self.assertEqual(student_ids, {str(self.student_a1.id), str(self.student_a2.id)})

        teacher_ids = self._ids(res["teachers"])
        self.assertEqual(teacher_ids, {str(self.teacher_a.id)})

        # All per-student tables are filtered by visible students, so 2 each.
        self.assertEqual(len(res["weekly_plans"]), 2)
        self.assertEqual(len(res["daily_records"]), 2)
        self.assertEqual(len(res["review_records"]), 2)
        self.assertEqual(len(res["evaluations"]), 2)

        # Notifications are per-recipient.
        self.assertEqual(len(res["notifications"]), 1)
        self.assertEqual(
            res["notifications"][0]["recipient_id"], str(self.teacher_a_user.id)
        )

        # Users included: actor + teacher A + students A1/A2 = 3 distinct.
        # (teacher_a_user IS the actor; student_a*_user are the visible
        # student users.)
        user_ids = self._ids(res["users"])
        self.assertIn(str(self.teacher_a_user.id), user_ids)
        self.assertIn(str(self.student_a1_user.id), user_ids)
        self.assertIn(str(self.student_a2_user.id), user_ids)
        self.assertNotIn(str(self.teacher_b_user.id), user_ids)
        self.assertNotIn(str(self.student_b1_user.id), user_ids)
        self.assertNotIn(str(self.student_b2_user.id), user_ids)
        self.assertNotIn(str(self.admin.id), user_ids)


class SyncPullStudentTests(SyncPullRBACSetup):
    def test_student_pulls_only_self(self):
        """Student A1's local DB contains only A1's own student row, plans,
        records, evaluations, and personal notifications — and the teacher
        record only via the visible-student lookup."""
        self.client.force_authenticate(self.student_a1_user)
        res = self._pull()

        student_ids = self._ids(res["students"])
        self.assertEqual(student_ids, {str(self.student_a1.id)})

        # Teacher A's row (the student's teacher) is included via the
        # parent/student branch of pull_visible_teachers; teacher B is not.
        teacher_ids = self._ids(res["teachers"])
        self.assertEqual(teacher_ids, {str(self.teacher_a.id)})

        self.assertEqual(len(res["weekly_plans"]), 1)
        self.assertEqual(len(res["daily_records"]), 1)
        self.assertEqual(len(res["review_records"]), 1)
        self.assertEqual(len(res["evaluations"]), 1)

        self.assertEqual(len(res["notifications"]), 1)
        self.assertEqual(
            res["notifications"][0]["recipient_id"], str(self.student_a1_user.id)
        )

        user_ids = self._ids(res["users"])
        self.assertIn(str(self.student_a1_user.id), user_ids)
        self.assertNotIn(str(self.student_a2_user.id), user_ids)
        self.assertNotIn(str(self.student_b1_user.id), user_ids)
        self.assertNotIn(str(self.student_b2_user.id), user_ids)


class SyncPullParentTests(SyncPullRBACSetup):
    def test_parent_pulls_only_linked_children(self):
        """Parent linked to A1 sees only A1 (not A2 or B1/B2) and only A1's
        teacher."""
        self.client.force_authenticate(self.parent_user)
        res = self._pull()

        student_ids = self._ids(res["students"])
        self.assertEqual(student_ids, {str(self.student_a1.id)})

        teacher_ids = self._ids(res["teachers"])
        self.assertEqual(teacher_ids, {str(self.teacher_a.id)})

        self.assertEqual(len(res["weekly_plans"]), 1)
        self.assertEqual(len(res["daily_records"]), 1)
        self.assertEqual(len(res["review_records"]), 1)
        self.assertEqual(len(res["evaluations"]), 1)

        self.assertEqual(len(res["parent_student_links"]), 1)
        self.assertEqual(len(res["parents"]), 1)
        self.assertEqual(res["parents"][0]["id"], str(self.parent.id))
