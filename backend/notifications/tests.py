"""
Notification Tests
Covers: FR-17, FR-18, FR-20
"""
from datetime import date

from rest_framework.test import APITestCase

from accounts.models import Parent, ParentStudentLink, Teacher, User
from notifications.models import Notification
from notifications.services.notification_services import send_absence_notification
from students.models import Student


class NotificationTestSetup(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            national_id="970590300000",
            phone_number="970590300000",
            password="adminpass", role="admin",
        )
        self.teacher_user = User.objects.create_user(
            national_id="970590300010",
            phone_number="970590300010",
            password="secret123", role="teacher",
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user, full_name="Teacher Not",
        )
        self.parent_user = User.objects.create_user(
            national_id="970590300020",
            phone_number="970590300020",
            password="secret123", role="parent",
        )
        self.parent = Parent.objects.create(
            user=self.parent_user, full_name="Parent Not",
            phone_number="970590300020",
        )
        self.parent2_user = User.objects.create_user(
            national_id="970590300021",
            phone_number="970590300021",
            password="secret123", role="parent",
        )
        self.parent2 = Parent.objects.create(
            user=self.parent2_user, full_name="Parent 2 Not",
            phone_number="970590300021",
        )
        self.student_user = User.objects.create_user(
            national_id="970590300030",
            phone_number="970590300030",
            password="secret123", role="student",
        )
        self.student = Student.objects.create(
            user=self.student_user, full_name="Student Not",
            national_id="NOT-001", birthdate=date(2012, 1, 1),
            grade="Grade 7", teacher=self.teacher,
        )
        ParentStudentLink.objects.create(parent=self.parent, student=self.student)
        ParentStudentLink.objects.create(parent=self.parent2, student=self.student)


class NotificationCRUDTests(NotificationTestSetup):
    def test_notification_list_returns_only_recipients_notifications(self):
        """NOT-01 / FR-20: Users only see their own notifications."""
        Notification.objects.create(
            recipient=self.parent_user, type="absence",
            title="Test", body="Body",
        )
        Notification.objects.create(
            recipient=self.admin, type="announcement",
            title="Admin", body="Admin body",
        )

        self.client.force_authenticate(self.parent_user)
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 1)
        self.assertEqual(response.data["data"][0]["title"], "Test")

    def test_mark_single_notification_as_read(self):
        """NOT-02 / FR-20: Mark single notification as read."""
        n = Notification.objects.create(
            recipient=self.parent_user, type="absence",
            title="Unread", body="Body",
        )
        self.client.force_authenticate(self.parent_user)
        response = self.client.patch(f"/api/notifications/{n.id}/read/")
        self.assertEqual(response.status_code, 200)
        n.refresh_from_db()
        self.assertTrue(n.is_read)

    def test_mark_all_notifications_as_read(self):
        """NOT-03 / FR-20: Mark all as read, count matches."""
        for i in range(3):
            Notification.objects.create(
                recipient=self.parent_user, type="absence",
                title=f"N{i}", body="Body",
            )
        self.client.force_authenticate(self.parent_user)
        response = self.client.patch("/api/notifications/read-all/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            Notification.objects.filter(recipient=self.parent_user, is_read=False).count(), 0,
        )

    def test_cannot_mark_another_users_notification_as_read(self):
        """NOT-04: Cannot mark another user's notification as read (404)."""
        n = Notification.objects.create(
            recipient=self.admin, type="announcement",
            title="Admin Only", body="Body",
        )
        self.client.force_authenticate(self.parent_user)
        response = self.client.patch(f"/api/notifications/{n.id}/read/")
        self.assertEqual(response.status_code, 404)

    def test_unread_count_decrements_after_mark_read(self):
        """NOT-05: Unread count changes correctly."""
        for i in range(3):
            Notification.objects.create(
                recipient=self.parent_user, type="absence",
                title=f"N{i}", body="Body",
            )
        self.client.force_authenticate(self.parent_user)

        response = self.client.get("/api/notifications/")
        self.assertEqual(response.data["unread_count"], 3)

        n = Notification.objects.filter(recipient=self.parent_user).first()
        self.client.patch(f"/api/notifications/{n.id}/read/")

        response2 = self.client.get("/api/notifications/")
        self.assertEqual(response2.data["unread_count"], 2)


class AbsenceNotificationServiceTests(NotificationTestSetup):
    def test_absence_notification_creates_correct_type(self):
        """NOT-06 / FR-17: Absence notification has type='absence'."""
        result = send_absence_notification(student=self.student, date=date(2026, 4, 4))
        notifications = Notification.objects.filter(type="absence")
        self.assertTrue(notifications.exists())
        for n in notifications:
            self.assertEqual(n.type, "absence")

    def test_whatsapp_link_generated_correctly(self):
        """NOT-07 / FR-18: WhatsApp link has correct phone and message."""
        result = send_absence_notification(student=self.student, date=date(2026, 4, 4))
        self.assertTrue(len(result["whatsapp_links"]) > 0)
        for link in result["whatsapp_links"]:
            self.assertIn("wa.me/", link)
            self.assertIn(self.student.full_name.replace(" ", "%20"), link)

    def test_absence_notification_sent_to_all_linked_parents(self):
        """NOT-08 / FR-17: Notification sent to ALL linked parents."""
        result = send_absence_notification(student=self.student, date=date(2026, 4, 4))
        self.assertEqual(result["notifications_sent"], 2)
        self.assertEqual(
            Notification.objects.filter(type="absence").count(), 2,
        )


# ==========================================================================
# Extended coverage — plan: endpoint matrix for /api/notifications/
# ==========================================================================
import uuid


NOTIFICATIONS_URL = "/api/notifications/"
ANNOUNCE_URL = "/api/notifications/announce/"


class NotificationListExtendedTests(NotificationTestSetup):
    def test_unauthenticated_list_returns_401(self):
        response = self.client.get(NOTIFICATIONS_URL)
        self.assertEqual(response.status_code, 401)

    def test_list_newest_first_ordering(self):
        first = Notification.objects.create(
            recipient=self.parent_user, type="announcement",
            title="First", body="b",
        )
        second = Notification.objects.create(
            recipient=self.parent_user, type="announcement",
            title="Second", body="b",
        )
        self.client.force_authenticate(self.parent_user)
        response = self.client.get(NOTIFICATIONS_URL)
        self.assertEqual(response.status_code, 200)
        titles = [row["title"] for row in response.data["data"]]
        self.assertEqual(titles[0], "Second")
        self.assertEqual(titles[1], "First")

    def test_unread_count_matches_only_own_unread(self):
        Notification.objects.create(
            recipient=self.parent_user, type="announcement",
            title="A", body="b", is_read=False,
        )
        Notification.objects.create(
            recipient=self.parent_user, type="announcement",
            title="B", body="b", is_read=True,
        )
        Notification.objects.create(
            recipient=self.admin, type="announcement",
            title="C", body="b", is_read=False,
        )
        self.client.force_authenticate(self.parent_user)
        response = self.client.get(NOTIFICATIONS_URL)
        self.assertEqual(response.data["unread_count"], 1)


class NotificationMarkReadIdempotencyTests(NotificationTestSetup):
    def test_rereading_already_read_notification_remains_200(self):
        n = Notification.objects.create(
            recipient=self.parent_user, type="announcement",
            title="R", body="b", is_read=True,
        )
        self.client.force_authenticate(self.parent_user)
        response = self.client.patch(f"{NOTIFICATIONS_URL}{n.id}/read/")
        self.assertEqual(response.status_code, 200)
        n.refresh_from_db()
        self.assertTrue(n.is_read)

    def test_unknown_notification_id_returns_404(self):
        self.client.force_authenticate(self.parent_user)
        response = self.client.patch(f"{NOTIFICATIONS_URL}{uuid.uuid4()}/read/")
        self.assertEqual(response.status_code, 404)


class NotificationMarkAllReadExtendedTests(NotificationTestSetup):
    def test_mark_all_does_not_touch_other_users_notifications(self):
        Notification.objects.create(
            recipient=self.parent_user, type="absence", title="A", body="b",
        )
        Notification.objects.create(
            recipient=self.parent2_user, type="absence", title="B", body="b",
        )
        self.client.force_authenticate(self.parent_user)
        self.client.patch(f"{NOTIFICATIONS_URL}read-all/")
        self.assertEqual(
            Notification.objects.filter(recipient=self.parent_user, is_read=False).count(),
            0,
        )
        self.assertEqual(
            Notification.objects.filter(recipient=self.parent2_user, is_read=False).count(),
            1,
        )

    def test_second_call_is_idempotent(self):
        Notification.objects.create(
            recipient=self.parent_user, type="absence", title="A", body="b",
        )
        self.client.force_authenticate(self.parent_user)
        self.client.patch(f"{NOTIFICATIONS_URL}read-all/")
        response = self.client.patch(f"{NOTIFICATIONS_URL}read-all/")
        self.assertEqual(response.status_code, 200)


class AnnouncementCreateTests(NotificationTestSetup):
    def test_non_admin_forbidden(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            ANNOUNCE_URL,
            {"title": "Hi", "body": "Body"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_broadcasts_to_all_except_self(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            ANNOUNCE_URL,
            {"title": "All Hands", "body": "General announcement"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(
            Notification.objects.filter(
                recipient=self.admin, title="All Hands"
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.parent_user, title="All Hands"
            ).exists()
        )

    def test_admin_broadcasts_to_role(self):
        self.client.force_authenticate(self.admin)
        self.client.post(
            ANNOUNCE_URL,
            {"title": "For Parents", "body": "Body", "target_roles": ["parent"]},
            format="json",
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.parent_user, title="For Parents"
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                recipient=self.teacher_user, title="For Parents"
            ).exists()
        )

    def test_admin_broadcasts_to_specific_user_ids(self):
        self.client.force_authenticate(self.admin)
        self.client.post(
            ANNOUNCE_URL,
            {
                "title": "Targeted",
                "body": "Body",
                "target_user_ids": [str(self.teacher_user.id)],
            },
            format="json",
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.teacher_user, title="Targeted"
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                recipient=self.parent_user, title="Targeted"
            ).exists()
        )

    def test_missing_title_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            ANNOUNCE_URL, {"body": "No title"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
