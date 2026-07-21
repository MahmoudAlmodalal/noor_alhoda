import uuid
from datetime import date

from rest_framework.test import APITestCase

from accounts.models import Parent, ParentStudentLink, User
from notifications.models import Notification
from students.models import Student
from teacher.models import Teacher


DIRECT_MESSAGE_URL = "/api/notifications/direct-message/"


class DirectMessagingTestSetup(APITestCase):
    def setUp(self):
        # Admin user
        self.admin = User.objects.create_user(
            national_id="970590000001",
            phone_number="970590000001",
            password="adminpass",
            role="admin",
        )

        # Teacher 1 & Teacher 2 users
        self.teacher1_user = User.objects.create_user(
            national_id="970590000010",
            phone_number="970590000010",
            password="teacher1pass",
            role="teacher",
        )
        self.teacher1 = Teacher.objects.create(
            user=self.teacher1_user,
            full_name="المعلم الأول",
        )

        self.teacher2_user = User.objects.create_user(
            national_id="970590000011",
            phone_number="970590000011",
            password="teacher2pass",
            role="teacher",
        )
        self.teacher2 = Teacher.objects.create(
            user=self.teacher2_user,
            full_name="المعلم الثاني",
        )

        # Student 1 (assigned to Teacher 1) with student user account & 2 linked parents
        self.student1_user = User.objects.create_user(
            national_id="970590000020",
            phone_number="970590000020",
            password="studentpass",
            role="student",
        )
        self.student1 = Student.objects.create(
            user=self.student1_user,
            full_name="طالب الحلقة الأولى",
            birthdate=date(2013, 5, 10),
            grade="Grade 6",
            teacher=self.teacher1,
        )

        self.parent1_user = User.objects.create_user(
            national_id="970590000030",
            phone_number="970590000030",
            password="parentpass1",
            role="parent",
        )
        self.parent1 = Parent.objects.create(
            user=self.parent1_user,
            full_name="ولي أمر 1",
            phone_number="970590000030",
        )

        self.parent2_user = User.objects.create_user(
            national_id="970590000031",
            phone_number="970590000031",
            password="parentpass2",
            role="parent",
        )
        self.parent2 = Parent.objects.create(
            user=self.parent2_user,
            full_name="ولي أمر 2",
            phone_number="970590000031",
        )

        ParentStudentLink.objects.create(parent=self.parent1, student=self.student1)
        ParentStudentLink.objects.create(parent=self.parent2, student=self.student1)

        # Student 2 (assigned to Teacher 2)
        self.student2_user = User.objects.create_user(
            national_id="970590000021",
            phone_number="970590000021",
            password="studentpass2",
            role="student",
        )
        self.student2 = Student.objects.create(
            user=self.student2_user,
            full_name="طالب الحلقة الثانية",
            birthdate=date(2014, 2, 14),
            grade="Grade 5",
            teacher=self.teacher2,
        )


class TeacherDirectMessagingTests(DirectMessagingTestSetup):
    def test_teacher_can_message_assigned_student(self):
        """T005 / US1: Teacher sends a direct message to a student in their circle."""
        self.client.force_authenticate(self.teacher1_user)
        payload = {
            "student_id": str(self.student1.id),
            "title": "تنبيه بشأن اختبار التسميع",
            "body": "اختبار التسميع لسورة البقرة يوم الخميس.",
        }
        response = self.client.post(DIRECT_MESSAGE_URL, payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["student_id"], str(self.student1.id))
        self.assertEqual(response.data["data"]["notifications_created"], 3)
        self.assertEqual(response.data["data"]["recipients_count"], 3)

        # Check notifications created in DB
        created_notifs = Notification.objects.filter(title="تنبيه بشأن اختبار التسميع")
        self.assertEqual(created_notifs.count(), 3)
        recipients = set(created_notifs.values_list("recipient_id", flat=True))
        expected_recipients = {self.student1_user.id, self.parent1_user.id, self.parent2_user.id}
        self.assertEqual(recipients, expected_recipients)
        for n in created_notifs:
            self.assertEqual(n.type, "direct_message")
            self.assertEqual(n.body, "اختبار التسميع لسورة البقرة يوم الخميس.")

    def test_teacher_cannot_message_unassigned_student(self):
        """T005 / US1: Teacher fails to message a student outside their circle (403 Forbidden)."""
        self.client.force_authenticate(self.teacher1_user)
        payload = {
            "student_id": str(self.student2.id),
            "title": "رسالة غير مصرحة",
            "body": "محاولة إرسال طالب خارج الحلقة.",
        }
        response = self.client.post(DIRECT_MESSAGE_URL, payload, format="json")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(response.data["success"])
        self.assertIn("ليس لديك صلاحية", response.data["error"]["message"])
        self.assertEqual(Notification.objects.filter(title="رسالة غير مصرحة").count(), 0)

    def test_admin_can_message_any_student(self):
        """T005 / US1 & US2: Admin can send a direct message to any student center-wide."""
        self.client.force_authenticate(self.admin)
        payload = {
            "student_id": str(self.student2.id),
            "title": "رسالة إدارية",
            "body": "رسالة من الإدارة للطالب.",
        }
        response = self.client.post(DIRECT_MESSAGE_URL, payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["success"])
        self.assertGreaterEqual(response.data["data"]["notifications_created"], 1)

    def test_direct_message_nonexistent_student(self):
        """T005 / US1: DM to non-existent student ID returns 404 Not Found."""
        self.client.force_authenticate(self.teacher1_user)
        payload = {
            "student_id": str(uuid.uuid4()),
            "title": "تست",
            "body": "تجربة طالب غير موجود.",
        }
        response = self.client.post(DIRECT_MESSAGE_URL, payload, format="json")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["error"]["message"], "الطالب غير موجود.")

    def test_direct_message_missing_required_fields(self):
        """T005 / US1: DM with missing fields returns 400 Bad Request."""
        self.client.force_authenticate(self.teacher1_user)
        payload = {
            "student_id": str(self.student1.id),
            "title": "",  # Empty title
        }
        response = self.client.post(DIRECT_MESSAGE_URL, payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])

    def test_unauthenticated_direct_message_denied(self):
        """T005 / US1: Unauthenticated request returns 401 Unauthorized."""
        payload = {
            "student_id": str(self.student1.id),
            "title": "عنوان",
            "body": "نص",
        }
        response = self.client.post(DIRECT_MESSAGE_URL, payload, format="json")
        self.assertEqual(response.status_code, 401)


class AdminDirectMessagingTests(DirectMessagingTestSetup):
    def test_admin_can_message_any_student_across_circles(self):
        """T011 / US2: Admin can send direct message to students in any circle across the center."""
        self.client.force_authenticate(self.admin)

        # Admin messaging student 1 (in teacher1 circle)
        res1 = self.client.post(
            DIRECT_MESSAGE_URL,
            {
                "student_id": str(self.student1.id),
                "title": "إشعار إداري لجميع الطلاب",
                "body": "تنبيه من إدارة المركز للطالب الأول.",
            },
            format="json",
        )
        self.assertEqual(res1.status_code, 201)
        self.assertTrue(res1.data["success"])
        self.assertEqual(res1.data["data"]["notifications_created"], 3)

        # Admin messaging student 2 (in teacher2 circle)
        res2 = self.client.post(
            DIRECT_MESSAGE_URL,
            {
                "student_id": str(self.student2.id),
                "title": "إشعار إداري للطلاب 2",
                "body": "تنبيه من إدارة المركز للطالب الثاني.",
            },
            format="json",
        )
        self.assertEqual(res2.status_code, 201)
        self.assertTrue(res2.data["success"])
        self.assertGreaterEqual(res2.data["data"]["notifications_created"], 1)

    def test_admin_direct_message_parent_co_notification(self):
        """T011 / US2: Admin direct message automatically fanout notifies linked parent accounts."""
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            DIRECT_MESSAGE_URL,
            {
                "student_id": str(self.student1.id),
                "title": "ملاحظة إدارية شائعة",
                "body": "تفاصيل الرسالة الإدارية.",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        notifs = Notification.objects.filter(title="ملاحظة إدارية شائعة")
        self.assertEqual(notifs.count(), 3)
        recipient_ids = set(notifs.values_list("recipient_id", flat=True))
        self.assertEqual(recipient_ids, {self.student1_user.id, self.parent1_user.id, self.parent2_user.id})

    def test_superuser_can_send_direct_message(self):
        """T011 / US2: Django superuser with is_superuser=True can bypass circle RBAC."""
        superuser = User.objects.create_superuser(
            national_id="970590000099",
            phone_number="970590000099",
            password="superpassword",
        )
        self.client.force_authenticate(superuser)
        res = self.client.post(
            DIRECT_MESSAGE_URL,
            {
                "student_id": str(self.student2.id),
                "title": "رسالة من السوبر أدمن",
                "body": "اختبار صلاحية السوبر أدمن.",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data["success"])

    def test_admin_direct_message_fanout_handles_single_parent(self):
        """T011 / US2: Admin DM to student with single parent notifies student and single parent."""
        student_user3 = User.objects.create_user(
            national_id="970590000022",
            phone_number="970590000022",
            password="studentpass3",
            role="student",
        )
        student3 = Student.objects.create(
            user=student_user3,
            full_name="طالب بولي أمر واحد",
            birthdate=date(2015, 1, 1),
            grade="Grade 4",
            teacher=self.teacher1,
        )
        ParentStudentLink.objects.create(parent=self.parent1, student=student3)

        self.client.force_authenticate(self.admin)
        res = self.client.post(
            DIRECT_MESSAGE_URL,
            {
                "student_id": str(student3.id),
                "title": "رسالة خاصة للطالب 3",
                "body": "رسالة موجهة لطالب بولي أمر واحد.",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["data"]["notifications_created"], 2)
        self.assertEqual(res.data["data"]["recipients_count"], 2)
        created_recipients = set(Notification.objects.filter(title="رسالة خاصة للطالب 3").values_list("recipient_id", flat=True))
        self.assertEqual(created_recipients, {student_user3.id, self.parent1_user.id})


