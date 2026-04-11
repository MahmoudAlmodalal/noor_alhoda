"""
RBAC & Student Management Tests
Covers: FR-07, FR-08, FR-09, FR-10, FR-11, Features 2.1-2.6
"""
from datetime import date

from rest_framework.test import APITestCase

from accounts.models import User, Teacher, Parent, ParentStudentLink
from students.models import Student


class StudentTestSetup(APITestCase):
    """Shared setup for student tests."""

    def setUp(self):
        # Admin
        self.admin = User.objects.create_user(
            phone_number="970590100000",
            password="adminpass",
            role="admin",
        )

        # Teacher A + profile
        self.teacher_a_user = User.objects.create_user(
            phone_number="970590100010",
            password="secret123",
            role="teacher",
        )
        self.teacher_a = Teacher.objects.create(
            user=self.teacher_a_user,
            full_name="Teacher A",
            max_students=25,
        )

        # Teacher B + profile
        self.teacher_b_user = User.objects.create_user(
            phone_number="970590100020",
            password="secret123",
            role="teacher",
        )
        self.teacher_b = Teacher.objects.create(
            user=self.teacher_b_user,
            full_name="Teacher B",
            max_students=2,
        )

        # Student A (belongs to teacher A)
        self.student_a_user = User.objects.create_user(
            phone_number="970590100030",
            password="secret123",
            role="student",
        )
        self.student_a = Student.objects.create(
            user=self.student_a_user,
            full_name="Student A",
            national_id="STU-A-001",
            birthdate=date(2012, 1, 1),
            grade="Grade 7",
            teacher=self.teacher_a,
        )

        # Student B (belongs to teacher B)
        self.student_b_user = User.objects.create_user(
            phone_number="970590100040",
            password="secret123",
            role="student",
        )
        self.student_b = Student.objects.create(
            user=self.student_b_user,
            full_name="Student B",
            national_id="STU-B-001",
            birthdate=date(2012, 2, 2),
            grade="Grade 8",
            teacher=self.teacher_b,
        )

        # Parent linked to student A
        self.parent_user = User.objects.create_user(
            phone_number="970590100050",
            password="secret123",
            role="parent",
        )
        self.parent = Parent.objects.create(
            user=self.parent_user,
            full_name="Parent A",
            phone_number="970590100050",
        )
        ParentStudentLink.objects.create(parent=self.parent, student=self.student_a)


class StudentCreateTests(StudentTestSetup):
    def test_admin_creates_student_with_required_fields(self):
        """STU-01: Admin can create a student with all required fields."""
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/students/create/",
            {
                "full_name": "New Student",
                "national_id": "NEW-001",
                "birthdate": "2013-05-15",
                "grade": "Grade 6",
                "phone_number": "970590199999",
                "guardian_name": "والد الطالب الجديد",
                "guardian_mobile": "970590100000",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Student.objects.filter(national_id="NEW-001").exists())

    def test_non_admin_cannot_create_student(self):
        """STU-02: Non-admin gets 403."""
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            "/api/students/create/",
            {
                "full_name": "Blocked Student",
                "national_id": "BLOCK-001",
                "birthdate": "2013-01-01",
                "grade": "Grade 7",
                "phone_number": "970590199998",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_duplicate_national_id_rejected(self):
        """STU-03: Duplicate national_id returns 400."""
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/students/create/",
            {
                "full_name": "Duplicate NID",
                "national_id": "STU-A-001",
                "birthdate": "2013-01-01",
                "grade": "Grade 7",
                "phone_number": "970590199997",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class StudentRBACTests(StudentTestSetup):
    def test_teacher_a_cannot_access_teacher_b_student(self):
        """STU-04 / FR-08: Teacher A cannot access Teacher B's student."""
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.get(f"/api/students/{self.student_b.id}/")
        self.assertEqual(response.status_code, 403)

    def test_student_can_only_view_own_profile(self):
        """STU-05 / FR-09: Student can only view self."""
        self.client.force_authenticate(self.student_a_user)
        response = self.client.get(f"/api/students/{self.student_a.id}/")
        self.assertEqual(response.status_code, 200)

        response2 = self.client.get(f"/api/students/{self.student_b.id}/")
        self.assertEqual(response2.status_code, 403)

    def test_parent_can_view_linked_child(self):
        """STU-06 / FR-10: Parent can view linked child."""
        self.client.force_authenticate(self.parent_user)
        response = self.client.get(f"/api/students/{self.student_a.id}/")
        self.assertEqual(response.status_code, 200)

    def test_parent_cannot_view_unlinked_student(self):
        """STU-07 / FR-10: Parent cannot view unlinked student."""
        self.client.force_authenticate(self.parent_user)
        response = self.client.get(f"/api/students/{self.student_b.id}/")
        self.assertEqual(response.status_code, 403)

    def test_student_list_for_teacher_returns_own_students_only(self):
        """STU-08 / FR-11: Teacher's student list is scoped."""
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.get("/api/students/")
        self.assertEqual(response.status_code, 200)
        student_ids = [s["id"] for s in response.data["data"]["results"]]
        self.assertIn(str(self.student_a.id), student_ids)
        self.assertNotIn(str(self.student_b.id), student_ids)

    def test_student_list_search_by_name(self):
        """STU-09: Search by student name works."""
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/students/?search=Student A")
        self.assertEqual(response.status_code, 200)
        results = response.data["data"]["results"]
        self.assertTrue(any(s["full_name"] == "Student A" for s in results))

    def test_student_list_filter_by_teacher(self):
        """STU-10: Filter by teacher_id works."""
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/students/?teacher_id={self.teacher_a.id}")
        self.assertEqual(response.status_code, 200)
        for s in response.data["data"]["results"]:
            self.assertEqual(s.get("teacher_id") or s.get("teacher", {}).get("id"), str(self.teacher_a.id))


class StudentOperationsTests(StudentTestSetup):
    def test_admin_soft_deletes_student(self):
        """STU-11 / Feature 2.5: Soft-delete deactivates student and user."""
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"/api/students/{self.student_a.id}/delete/")
        self.assertEqual(response.status_code, 200)
        self.student_a.refresh_from_db()
        self.assertFalse(self.student_a.is_active)
        self.student_a.user.refresh_from_db()
        self.assertFalse(self.student_a.user.is_active)

    def test_admin_assigns_teacher_respects_max_students(self):
        """STU-12 / Feature 2.4: Assign teacher checks max_students limit."""
        # Teacher B has max_students=2, already has 1 student
        extra_user = User.objects.create_user(
            phone_number="970590100060", password="s", role="student",
        )
        Student.objects.create(
            user=extra_user, full_name="Extra", national_id="EX-001",
            birthdate=date(2012, 1, 1), grade="G7", teacher=self.teacher_b,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/students/{self.student_a.id}/assign-teacher/",
            {"teacher_id": str(self.teacher_b.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_admin_links_parent_to_student(self):
        """STU-13 / Feature 2.6: Admin can link a parent to a student."""
        new_parent_user = User.objects.create_user(
            phone_number="970590100070", password="s", role="parent",
        )
        new_parent = Parent.objects.create(
            user=new_parent_user, full_name="New Parent",
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/students/{self.student_b.id}/link-parent/",
            {"parent_id": str(new_parent.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            ParentStudentLink.objects.filter(parent=new_parent, student=self.student_b).exists()
        )

    def test_duplicate_parent_student_link_rejected(self):
        """STU-14: Duplicate link returns error."""
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/students/{self.student_a.id}/link-parent/",
            {"parent_id": str(self.parent.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
