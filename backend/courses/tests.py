"""
Courses tests — CRUD + student-course enrollment endpoints.

Contract matrix per the backend API test plan.
"""
import uuid
from datetime import date

from rest_framework.test import APITestCase

from accounts.models import Parent, ParentStudentLink, Teacher, User
from courses.models import Course, StudentCourse
from students.models import Student


COURSES_URL = "/api/courses/"
COURSE_CREATE_URL = "/api/courses/create/"
STUDENT_COURSES_URL = "/api/courses/students/"


class CoursesFixture(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            national_id="5000000001",
            phone_number="0596000001",
            password="adminpass",
            role="admin",
        )

        self.teacher_user = User.objects.create_user(
            national_id="5000000002",
            phone_number="0596000002",
            password="teacherpass",
            role="teacher",
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user, full_name="Teacher Courses",
        )

        self.student_user = User.objects.create_user(
            national_id="5000000003",
            phone_number="0596000003",
            password="studentpass",
            role="student",
        )
        self.student = Student.objects.create(
            user=self.student_user,
            full_name="Student Courses",
            national_id="CRS-STU-001",
            birthdate=date(2012, 1, 1),
            grade="Grade 6",
            teacher=self.teacher,
        )

        self.parent_user = User.objects.create_user(
            national_id="5000000004",
            phone_number="0596000004",
            password="parentpass",
            role="parent",
        )
        self.parent = Parent.objects.create(
            user=self.parent_user, full_name="Parent Courses",
        )
        ParentStudentLink.objects.create(
            parent=self.parent, student=self.student,
        )

        self.course_one = Course.objects.create(name="التجويد")
        self.course_two = Course.objects.create(name="مخارج الحروف")


class CourseListTests(CoursesFixture):
    def test_authenticated_list_for_all_roles(self):
        for user in (
            self.admin,
            self.teacher_user,
            self.student_user,
            self.parent_user,
        ):
            self.client.force_authenticate(user)
            response = self.client.get(COURSES_URL)
            self.assertEqual(response.status_code, 200)
            self.assertGreaterEqual(len(response.data["data"]), 2)

    def test_unauthenticated_returns_401(self):
        response = self.client.get(COURSES_URL)
        self.assertEqual(response.status_code, 401)

    def test_list_newest_first_ordering(self):
        latest = Course.objects.create(name="أحدث دورة")
        self.client.force_authenticate(self.admin)
        response = self.client.get(COURSES_URL)
        names = [row["name"] for row in response.data["data"]]
        self.assertEqual(names[0], latest.name)


class CourseCreateTests(CoursesFixture):
    def test_admin_create_success(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            COURSE_CREATE_URL,
            {"name": "دورة جديدة", "description": "وصف"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Course.objects.filter(name="دورة جديدة").exists())

    def test_blank_name_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            COURSE_CREATE_URL, {"name": ""}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_duplicate_name_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            COURSE_CREATE_URL,
            {"name": self.course_one.name},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            COURSE_CREATE_URL, {"name": "For Teacher"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_returns_401(self):
        response = self.client.post(
            COURSE_CREATE_URL, {"name": "Nope"}, format="json"
        )
        self.assertEqual(response.status_code, 401)


class CourseDetailTests(CoursesFixture):
    def test_authenticated_get_success(self):
        self.client.force_authenticate(self.student_user)
        response = self.client.get(f"{COURSES_URL}{self.course_one.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["name"], self.course_one.name)

    def test_unknown_course_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{COURSES_URL}{uuid.uuid4()}/")
        self.assertEqual(response.status_code, 404)

    def test_admin_patch_name(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{COURSES_URL}{self.course_one.id}/",
            {"name": "تجويد متقدم"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.course_one.refresh_from_db()
        self.assertEqual(self.course_one.name, "تجويد متقدم")

    def test_non_admin_patch_forbidden(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.patch(
            f"{COURSES_URL}{self.course_one.id}/",
            {"name": "no"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_patch_unknown_course_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{COURSES_URL}{uuid.uuid4()}/",
            {"name": "x"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_admin_delete_success(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"{COURSES_URL}{self.course_two.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Course.objects.filter(id=self.course_two.id).exists())

    def test_delete_cascades_student_enrollments(self):
        StudentCourse.objects.create(
            student=self.student, course=self.course_two,
        )
        self.client.force_authenticate(self.admin)
        self.client.delete(f"{COURSES_URL}{self.course_two.id}/")
        self.assertFalse(
            StudentCourse.objects.filter(course=self.course_two).exists()
        )

    def test_non_admin_delete_forbidden(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.delete(f"{COURSES_URL}{self.course_one.id}/")
        self.assertEqual(response.status_code, 403)

    def test_delete_unknown_course_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"{COURSES_URL}{uuid.uuid4()}/")
        self.assertEqual(response.status_code, 404)


class StudentCoursesListTests(CoursesFixture):
    def test_admin_sees_all_courses_with_completion_flags(self):
        StudentCourse.objects.create(
            student=self.student, course=self.course_one, is_completed=True,
            completion_date=date.today(),
        )
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{STUDENT_COURSES_URL}{self.student.id}/")
        self.assertEqual(response.status_code, 200)
        rows = response.data["data"]
        # Should list both courses with is_completed true/false
        self.assertEqual(len(rows), 2)
        flags = {r["course_name"]: r["is_completed"] for r in rows}
        self.assertTrue(flags[self.course_one.name])
        self.assertFalse(flags[self.course_two.name])

    def test_teacher_own_student_allowed(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.get(f"{STUDENT_COURSES_URL}{self.student.id}/")
        self.assertEqual(response.status_code, 200)

    def test_student_self_allowed(self):
        self.client.force_authenticate(self.student_user)
        response = self.client.get(f"{STUDENT_COURSES_URL}{self.student.id}/")
        self.assertEqual(response.status_code, 200)

    def test_parent_linked_child_allowed(self):
        self.client.force_authenticate(self.parent_user)
        response = self.client.get(f"{STUDENT_COURSES_URL}{self.student.id}/")
        self.assertEqual(response.status_code, 200)

    def test_unauthorized_teacher_forbidden(self):
        other_teacher_user = User.objects.create_user(
            national_id="5000000099",
            phone_number="0596000099",
            password="t",
            role="teacher",
        )
        Teacher.objects.create(user=other_teacher_user, full_name="Other")
        self.client.force_authenticate(other_teacher_user)
        response = self.client.get(f"{STUDENT_COURSES_URL}{self.student.id}/")
        self.assertEqual(response.status_code, 403)


class StudentCourseToggleTests(CoursesFixture):
    def test_admin_toggle_complete_sets_completion_date(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"{STUDENT_COURSES_URL}{self.student.id}/toggle/",
            {"course_id": str(self.course_one.id), "is_completed": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        enrollment = StudentCourse.objects.get(
            student=self.student, course=self.course_one
        )
        self.assertTrue(enrollment.is_completed)
        self.assertIsNotNone(enrollment.completion_date)

    def test_admin_toggle_incomplete_clears_completion_date(self):
        StudentCourse.objects.create(
            student=self.student, course=self.course_one,
            is_completed=True, completion_date=date.today(),
        )
        self.client.force_authenticate(self.admin)
        self.client.post(
            f"{STUDENT_COURSES_URL}{self.student.id}/toggle/",
            {"course_id": str(self.course_one.id), "is_completed": False},
            format="json",
        )
        enrollment = StudentCourse.objects.get(
            student=self.student, course=self.course_one
        )
        self.assertFalse(enrollment.is_completed)
        self.assertIsNone(enrollment.completion_date)

    def test_invalid_course_id_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"{STUDENT_COURSES_URL}{self.student.id}/toggle/",
            {"course_id": str(uuid.uuid4()), "is_completed": True},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_invalid_student_id_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"{STUDENT_COURSES_URL}{uuid.uuid4()}/toggle/",
            {"course_id": str(self.course_one.id), "is_completed": True},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(self.teacher_user)
        response = self.client.post(
            f"{STUDENT_COURSES_URL}{self.student.id}/toggle/",
            {"course_id": str(self.course_one.id), "is_completed": True},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
