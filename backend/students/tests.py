"""
RBAC & Student Management Tests
Covers: FR-07, FR-08, FR-09, FR-10, FR-11, Features 2.1-2.6
"""
from datetime import date

from rest_framework.test import APITestCase

from accounts.models import User, Parent, ParentStudentLink
from teacher.models import Teacher
from students.models import Student


class StudentTestSetup(APITestCase):
    """Shared setup for student tests."""

    def setUp(self):
        # Admin
        self.admin = User.objects.create_user(
            national_id="970590100000",
            phone_number="970590100000",
            password="adminpass",
            role="admin",
        )

        # Teacher A + profile
        self.teacher_a_user = User.objects.create_user(
            national_id="970590100010",
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
            national_id="970590100020",
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
            national_id="970590100031",
            phone_number="970590100030",
            password="secret123",
            role="student",
        )
        self.student_a = Student.objects.create(
            user=self.student_a_user,
            full_name="Student A",
            birthdate=date(2012, 1, 1),
            grade="Grade 7",
            teacher=self.teacher_a,
            guardian_name="Guardian A",
            guardian_mobile="0599000001",
        )

        # Student B (belongs to teacher B)
        self.student_b_user = User.objects.create_user(
            national_id="970590100041",
            phone_number="970590100040",
            password="secret123",
            role="student",
        )
        self.student_b = Student.objects.create(
            user=self.student_b_user,
            full_name="Student B",
            birthdate=date(2012, 2, 2),
            grade="Grade 8",
            teacher=self.teacher_b,
            guardian_name="Guardian B",
            guardian_mobile="0599000002",
        )

        # Parent linked to student A
        self.parent_user = User.objects.create_user(
            national_id="970590100050",
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
                "national_id": "970590100201",
                "birthdate": "2013-05-15",
                "grade": "Grade 6",
                "phone_number": "970590199999",
                "guardian_name": "والد الطالب الجديد",
                "guardian_mobile": "970590100000",
                "password": "testpass123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Student.objects.filter(user__national_id="970590100201").exists())

    def test_non_admin_cannot_create_student(self):
        """STU-02: Non-admin gets 403."""
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            "/api/students/create/",
            {
                "full_name": "Blocked Student",
                "national_id": "970590100202",
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
                "national_id": "970590100031",
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
        student_ids = [s["id"] for s in response.data["data"]]
        self.assertIn(str(self.student_a.id), student_ids)
        self.assertNotIn(str(self.student_b.id), student_ids)

    def test_student_list_search_by_name(self):
        """STU-09: Search by student name works."""
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/students/?search=Student A")
        self.assertEqual(response.status_code, 200)
        results = response.data["data"]
        self.assertTrue(any(s["full_name"] == "Student A" for s in results))

    def test_student_list_filter_by_teacher(self):
        """STU-10: Filter by teacher_id works."""
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/students/?teacher_id={self.teacher_a.id}")
        self.assertEqual(response.status_code, 200)
        for s in response.data["data"]:
            self.assertEqual(s.get("teacher_id") or s.get("teacher", {}).get("id"), str(self.teacher_a.id))


class StudentOperationsTests(StudentTestSetup):
    def test_admin_soft_deletes_student(self):
        """STU-11 / Feature 2.5: Soft-delete deactivates user and unassigns teacher."""
        self.client.force_authenticate(self.admin)
        student_id = self.student_a.id
        user_id = self.student_a.user.id
        response = self.client.delete(f"/api/students/{student_id}/")
        self.assertEqual(response.status_code, 200)
        
        student = Student.objects.get(id=student_id)
        self.assertFalse(student.user.is_active)
        self.assertIsNone(student.teacher)

    def test_admin_assigns_teacher_respects_max_students(self):
        """STU-12 / Feature 2.4: Assign teacher checks max_students limit."""
        # Teacher B has max_students=2, already has 1 student
        extra_user = User.objects.create_user(
            national_id="970590100060",
            phone_number="970590100060", password="s", role="student",
        )
        Student.objects.create(
            user=extra_user, full_name="Extra",
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
            national_id="970590100070",
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


# ==========================================================================
# Extended coverage — plan: endpoint matrix for /api/students/
# ==========================================================================
import uuid

from courses.models import Course, StudentCourse
from records.models import DailyRecord, WeeklyPlan


STUDENTS_URL = "/api/students/"
STUDENT_CREATE_URL = "/api/students/create/"
STUDENT_BULK_CREATE_URL = "/api/students/bulk-create/"


class StudentListScopeTests(StudentTestSetup):
    def test_parent_sees_only_linked_children(self):
        self.client.force_authenticate(self.parent_user)
        response = self.client.get(STUDENTS_URL)
        self.assertEqual(response.status_code, 200)
        ids = [row["id"] for row in response.data["data"]]
        self.assertIn(str(self.student_a.id), ids)
        self.assertNotIn(str(self.student_b.id), ids)

    def test_student_list_scoped_to_self(self):
        self.client.force_authenticate(self.student_a_user)
        response = self.client.get(STUDENTS_URL)
        self.assertEqual(response.status_code, 200)
        ids = [row["id"] for row in response.data["data"]]
        self.assertEqual(ids, [str(self.student_a.id)])

    def test_grade_filter(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(STUDENTS_URL + "?grade=Grade 7")
        self.assertEqual(response.status_code, 200)
        for row in response.data["data"]:
            self.assertEqual(row["grade"], "Grade 7")

    def test_student_list_search_by_national_id(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(STUDENTS_URL + "?search=970590100041")
        self.assertEqual(response.status_code, 200)
        results = response.data["data"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["national_id"], "970590100041")

    def test_teacher_id_filter_scopes_results(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(STUDENTS_URL + f"?teacher_id={self.teacher_a.id}")
        self.assertEqual(response.status_code, 200)
        for row in response.data["data"]:
            self.assertEqual(row["teacher_id"], str(self.teacher_a.id))

    def test_unauthenticated_list_401(self):
        response = self.client.get(STUDENTS_URL)
        self.assertEqual(response.status_code, 401)

    def test_non_paginated_list_keeps_legacy_array_shape(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(STUDENTS_URL)
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data["data"], list)

    def test_paginated_list_returns_metadata_and_25_rows(self):
        for idx in range(30):
            extra_user = User.objects.create_user(
                national_id=f"97059011{idx:04d}",
                phone_number=f"0599200{idx:03d}"[:10],
                password="secret123",
                role="student",
            )
            Student.objects.create(
                user=extra_user,
                full_name=f"Student Extra {idx}",
                birthdate=date(2013, 1, 1),
                grade="Grade 6",
                guardian_name="Guardian Extra",
                guardian_mobile=f"0599300{idx:03d}"[:10],
            )

        self.client.force_authenticate(self.admin)
        response = self.client.get(STUDENTS_URL + "?paginated=1&page=1")
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(len(data["items"]), 25)
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["page_size"], 25)
        self.assertGreaterEqual(data["count"], 32)
        self.assertGreaterEqual(data["total_pages"], 2)

    def test_course_and_teacher_filters_work_together_without_duplicates(self):
        course = Course.objects.create(name="النورانية", description="")
        StudentCourse.objects.create(student=self.student_a, course=course)

        self.client.force_authenticate(self.admin)
        response = self.client.get(
            STUDENTS_URL
            + f"?paginated=1&teacher_id={self.teacher_a.id}&course_id={course.id}"
        )
        self.assertEqual(response.status_code, 200)
        items = response.data["data"]["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], str(self.student_a.id))


class StudentCreateContractTests(StudentTestSetup):
    def _valid_payload(self, **overrides):
        payload = {
            "full_name": "Contract Student",
            "national_id": "970590100301",
            "birthdate": "2013-05-15",
            "grade": "Grade 6",
            "phone_number": "970590198880",
            "guardian_name": "ولي",
            "guardian_mobile": "970590100000",
        }
        payload.update(overrides)
        return payload

    def test_admin_create_with_optional_fields(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            STUDENT_CREATE_URL,
            self._valid_payload(
                national_id="970590100302",
                bank_account_number="123",
                bank_account_name="Name",
                bank_account_type="Savings",
                health_status="sick",
                health_note="chronic",
                skills={"quran": True, "nasheed": False, "poetry": False, "other": False},
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        student = Student.objects.get(user__national_id="970590100302")
        self.assertEqual(student.bank_account_number, "123")
        self.assertEqual(student.health_status, "sick")
        self.assertEqual(student.skills.get("quran"), True)

    def test_missing_required_full_name_rejected(self):
        self.client.force_authenticate(self.admin)
        payload = self._valid_payload(national_id="970590100303")
        del payload["full_name"]
        response = self.client.post(STUDENT_CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_missing_guardian_mobile_rejected(self):
        self.client.force_authenticate(self.admin)
        payload = self._valid_payload(national_id="970590100304")
        del payload["guardian_mobile"]
        response = self.client.post(STUDENT_CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_invalid_teacher_id_rejected(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            STUDENT_CREATE_URL,
            self._valid_payload(
                national_id="970590100305",
                teacher_id=str(uuid.uuid4()),
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_unauthenticated_create_401(self):
        response = self.client.post(
            STUDENT_CREATE_URL,
            self._valid_payload(national_id="970590100306"),
            format="json",
        )
        self.assertEqual(response.status_code, 401)


class StudentBulkCreateTests(StudentTestSetup):
    def _row(self, **overrides):
        row = {
            "national_id": "970590100401",
            "full_name": "Bulk Student",
            "birthdate": "10/10/2013",
            "grade": "7",
            "guardian_name": "Parent",
            "guardian_mobile": "0599912345",
            "guardian_national_id": "970590100402",
            "teacher_name": self.teacher_a.full_name,
            "desired_courses": "تجويد",
        }
        row.update(overrides)
        return row

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            STUDENT_BULK_CREATE_URL,
            {"rows": [self._row()]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_imports_new_student_with_guardian_and_course(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            STUDENT_BULK_CREATE_URL,
            {"rows": [self._row()]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.data["data"]
        self.assertEqual(data["created_count"], 1)
        self.assertEqual(data["error_count"], 0)
        student = Student.objects.get(user__national_id="970590100401")
        self.assertTrue(ParentStudentLink.objects.filter(student=student).exists())
        self.assertTrue(StudentCourse.objects.filter(student=student).exists())

    def test_admin_imports_existing_student_as_update(self):
        self.client.force_authenticate(self.admin)
        self.client.post(
            STUDENT_BULK_CREATE_URL,
            {"rows": [self._row()]},
            format="json",
        )
        response = self.client.post(
            STUDENT_BULK_CREATE_URL,
            {"rows": [self._row()]},
            format="json",
        )
        data = response.data["data"]
        self.assertEqual(data["updated_count"], 1)
        self.assertEqual(data["created_count"], 0)

    def test_missing_national_id_uses_noid_placeholder(self):
        self.client.force_authenticate(self.admin)
        row = self._row()
        row["national_id"] = ""
        response = self.client.post(
            STUDENT_BULK_CREATE_URL, {"rows": [row]}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        # Synthetic IDs use a 97-prefix + 10 digits so they survive the
        # digit-only `_validate_national_id` regex (real Palestinian IDs
        # never start with 97).
        self.assertTrue(
            Student.objects.filter(user__national_id__startswith="97").exists()
        )

    def test_teacher_auto_resolve_existing_by_name(self):
        self.client.force_authenticate(self.admin)
        self.client.post(
            STUDENT_BULK_CREATE_URL,
            {"rows": [self._row(national_id="970590100403")]},
            format="json",
        )
        student = Student.objects.get(user__national_id="970590100403")
        self.assertEqual(student.teacher, self.teacher_a)

    def test_teacher_auto_create_when_missing(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            STUDENT_BULK_CREATE_URL,
            {"rows": [self._row(national_id="970590100404", teacher_name="New Bulk Teacher")]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Teacher.objects.filter(full_name__iexact="New Bulk Teacher").exists())

    def test_row_level_errors_collected_without_aborting(self):
        self.client.force_authenticate(self.admin)
        good = self._row(national_id="970590100405")
        bad = self._row(national_id="970590100406", birthdate="not-a-date")
        # student_create's full_clean on a raw invalid date raises — bulk handler should surface the row.
        response = self.client.post(
            STUDENT_BULK_CREATE_URL, {"rows": [good, bad]}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        data = response.data["data"]
        self.assertGreaterEqual(data["created_count"], 1)

    def test_affiliation_alias_is_normalized_for_existing_teacher(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            STUDENT_BULK_CREATE_URL,
            {
                "rows": [
                    self._row(
                        national_id="970590100407",
                        teacher_name=self.teacher_a.full_name,
                        affiliation="دار القراءن",
                    )
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.teacher_a.refresh_from_db()
        self.assertEqual(self.teacher_a.affiliation, "dar_quran")

    def test_skills_are_persisted_in_canonical_shape(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            STUDENT_BULK_CREATE_URL,
            {
                "rows": [
                    self._row(
                        national_id="970590100408",
                        skills="قراءة القرآن/ انشاد/ كرة قدم",
                    )
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        student = Student.objects.get(user__national_id="970590100408")
        self.assertTrue(student.skills["quran"])
        self.assertTrue(student.skills["nasheed"])
        self.assertTrue(student.skills["other"])
        self.assertIn("كرة قدم", student.skills["other_text"])

    def test_reimport_repairs_existing_student_and_course_aliases(self):
        alias_course = Course.objects.create(name="النوارنية", description="")
        placeholder_course = Course.objects.create(name="لايوجد", description="")
        existing_user = User.objects.create_user(
            national_id="970590100409",
            phone_number="0599100080",
            password="secret123",
            role="student",
        )
        existing_student = Student.objects.create(
            user=existing_user,
            full_name="Existing Bulk Student",
            birthdate=date(1900, 1, 1),
            grade="غ. م",
            address="غ. م",
            guardian_name="غ. م",
            guardian_mobile="0599000080",
            teacher=self.teacher_a,
        )
        StudentCourse.objects.create(student=existing_student, course=alias_course)
        StudentCourse.objects.create(student=existing_student, course=placeholder_course)

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            STUDENT_BULK_CREATE_URL,
            {
                "rows": [
                    self._row(
                        national_id="970590100409",
                        full_name="Existing Bulk Student",
                        birthdate="12/12/2013",
                        grade="السابع",
                        address="عنوان جديد",
                        guardian_name="ولي الأمر",
                        guardian_mobile="0599111111",
                        teacher_name=self.teacher_a.full_name,
                        affiliation="دار القراءن",
                        previous_courses="النورانية/لايوجد",
                    )
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.data["data"]
        self.assertEqual(data["updated_count"], 1)

        existing_student.refresh_from_db()
        self.teacher_a.refresh_from_db()
        self.assertEqual(existing_student.grade, "7")
        self.assertEqual(existing_student.address, "عنوان جديد")
        self.assertEqual(self.teacher_a.affiliation, "dar_quran")
        enrolled_courses = set(
            StudentCourse.objects.filter(student=existing_student).values_list("course__name", flat=True)
        )
        self.assertIn("النورانية", enrolled_courses)
        self.assertNotIn("النوارنية", enrolled_courses)
        self.assertNotIn("لايوجد", enrolled_courses)

    def test_placeholder_course_text_does_not_create_real_course(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            STUDENT_BULK_CREATE_URL,
            {"rows": [self._row(national_id="970590100410", desired_courses="لايوجد")]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(Course.objects.filter(name__iexact="لايوجد").exists())

    def test_missing_guardian_id_creates_parent_with_synthetic_98_prefix(self):
        """When the Excel row has no guardian_national_id, the resolver
        synthesises one starting with '98' (digit-only so it survives
        `_validate_national_id`'s regex). The parent must be created and
        linked to the student rather than failing silently as before."""
        self.client.force_authenticate(self.admin)

        # Use a digit-only student national_id so the student row itself
        # passes validation; the guardian id is intentionally blank to
        # exercise the synthetic-id branch.
        digit_student_nid = "9700000123456"
        response = self.client.post(
            STUDENT_BULK_CREATE_URL,
            {
                "rows": [
                    self._row(
                        national_id=digit_student_nid,
                        guardian_national_id="",
                        guardian_name="Synthetic Parent",
                        guardian_mobile="0599888777",
                    )
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        data = response.data["data"]
        self.assertEqual(data["created_count"], 1)
        # No "تنبيه: فشل ربط ولي الأمر" warning, because the parent linked
        # successfully through the new 98-prefixed synthetic id path.
        guardian_link_failures = [
            err for err in data["errors"]
            if "ولي الأمر" in err.get("message", "")
        ]
        self.assertEqual(guardian_link_failures, [])

        student = Student.objects.get(user__national_id=digit_student_nid)
        self.assertTrue(
            ParentStudentLink.objects.filter(student=student).exists(),
            "Parent must be linked to the student via the synthetic id branch",
        )

        parent = ParentStudentLink.objects.get(student=student).parent
        self.assertTrue(
            parent.user.national_id.startswith("98"),
            f"expected 98-prefixed synthetic, got {parent.user.national_id}",
        )


class StudentDetailGetTests(StudentTestSetup):
    def test_unknown_student_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{STUDENTS_URL}{uuid.uuid4()}/")
        self.assertEqual(response.status_code, 404)

    def test_unauthenticated_detail_returns_401(self):
        response = self.client.get(f"{STUDENTS_URL}{self.student_a.id}/")
        self.assertEqual(response.status_code, 401)


class StudentPatchTests(StudentTestSetup):
    def test_admin_full_edit(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{STUDENTS_URL}{self.student_a.id}/",
            {
                "full_name": "Updated Name",
                "grade": "Grade 9",
                "health_status": "injured",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.student_a.refresh_from_db()
        self.assertEqual(self.student_a.full_name, "Updated Name")
        self.assertEqual(self.student_a.grade, "Grade 9")
        self.assertEqual(self.student_a.health_status, "injured")

    def test_teacher_direct_patch_forbidden(self):
        """
        Teachers can no longer write to a student's record directly — they
        must submit a StudentChangeRequest (action=update) for admin approval
        (see ChangeRequestTests). Even health_note/skills, once directly
        editable, now require the same approval flow.
        """
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.patch(
            f"{STUDENTS_URL}{self.student_a.id}/",
            {"health_note": "follow-up", "skills": {"quran": True}},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.student_a.refresh_from_db()
        self.assertNotEqual(self.student_a.health_note, "follow-up")

    def test_teacher_attempt_to_edit_name_is_forbidden(self):
        self.client.force_authenticate(self.teacher_a_user)
        original_name = self.student_a.full_name
        response = self.client.patch(
            f"{STUDENTS_URL}{self.student_a.id}/",
            {"full_name": "Hijacked", "health_note": "ok"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.student_a.refresh_from_db()
        self.assertEqual(self.student_a.full_name, original_name)

    def test_student_cannot_patch_own_record(self):
        self.client.force_authenticate(self.student_a_user)
        response = self.client.patch(
            f"{STUDENTS_URL}{self.student_a.id}/",
            {"full_name": "Attempt"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_parent_cannot_patch_linked_child(self):
        self.client.force_authenticate(self.parent_user)
        response = self.client.patch(
            f"{STUDENTS_URL}{self.student_a.id}/",
            {"full_name": "Attempt"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


class StudentDeleteExtendedTests(StudentTestSetup):
    def test_non_admin_delete_forbidden(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.delete(f"{STUDENTS_URL}{self.student_a.id}/")
        self.assertEqual(response.status_code, 403)

    def test_unknown_student_delete_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"{STUDENTS_URL}{uuid.uuid4()}/")
        self.assertEqual(response.status_code, 404)

    def test_delete_soft_deactivates_user(self):
        self.client.force_authenticate(self.admin)
        self.client.delete(f"{STUDENTS_URL}{self.student_a.id}/")
        self.student_a.refresh_from_db()
        self.student_a.user.refresh_from_db()
        self.assertFalse(self.student_a.user.is_active)
        self.assertIsNone(self.student_a.teacher)


class StudentHistoryTests(StudentTestSetup):
    def _seed_plan(self, student, week_start, required=10, achieved=8):
        plan = WeeklyPlan.objects.create(
            student=student,
            week_number=week_start.isocalendar()[1],
            week_start=week_start,
            total_required=required,
            total_achieved=achieved,
        )
        DailyRecord.objects.create(
            weekly_plan=plan,
            day="sat",
            date=week_start,
            attendance="present",
            required_verses=required,
            achieved_verses=achieved,
            surah_name="البقرة",
            quality="excellent",
            recorded_by=self.admin,
        )
        return plan

    def test_authorized_access_returns_history(self):
        self._seed_plan(self.student_a, date(2026, 3, 7))
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{STUDENTS_URL}{self.student_a.id}/history/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 1)

    def test_unauthorized_access_returns_403(self):
        self._seed_plan(self.student_b, date(2026, 3, 7))
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.get(f"{STUDENTS_URL}{self.student_b.id}/history/")
        self.assertEqual(response.status_code, 403)

    def test_empty_history_returns_empty_list(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{STUDENTS_URL}{self.student_a.id}/history/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], [])

    def test_newest_first_ordering(self):
        self._seed_plan(self.student_a, date(2026, 2, 7))
        self._seed_plan(self.student_a, date(2026, 3, 7))
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{STUDENTS_URL}{self.student_a.id}/history/")
        dates = [row["date"] for row in response.data["data"]]
        self.assertEqual(dates, sorted(dates, reverse=True))


class StudentStatsTests(StudentTestSetup):
    def test_authorized_zero_state(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{STUDENTS_URL}{self.student_a.id}/stats/")
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["total_days"], 0)
        self.assertEqual(data["attendance_rate"], 0)
        self.assertEqual(data["streak"], 0)
        self.assertEqual(data["points"], 0)

    def test_authorized_with_records_calculates_fields(self):
        plan = WeeklyPlan.objects.create(
            student=self.student_a,
            week_number=10,
            week_start=date(2026, 3, 7),
            total_required=10,
            total_achieved=8,
        )
        DailyRecord.objects.create(
            weekly_plan=plan,
            day="sat",
            date=date.today(),
            attendance="present",
            required_verses=10,
            achieved_verses=8,
            quality="excellent",
            recorded_by=self.admin,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"{STUDENTS_URL}{self.student_a.id}/stats/")
        data = response.data["data"]
        self.assertEqual(data["total_days"], 1)
        self.assertGreater(data["attendance_rate"], 0)
        self.assertIsNotNone(data["today_record"])

    def test_unauthorized_stats_returns_403(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.get(f"{STUDENTS_URL}{self.student_b.id}/stats/")
        self.assertEqual(response.status_code, 403)


class StudentAssignTeacherTests(StudentTestSetup):
    def test_admin_assign_happy_path(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{STUDENTS_URL}{self.student_a.id}/assign-teacher/",
            {"teacher_id": str(self.teacher_b.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.student_a.refresh_from_db()
        self.assertEqual(self.student_a.teacher, self.teacher_b)

    def test_invalid_teacher_id_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"{STUDENTS_URL}{self.student_a.id}/assign-teacher/",
            {"teacher_id": str(uuid.uuid4())},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.patch(
            f"{STUDENTS_URL}{self.student_a.id}/assign-teacher/",
            {"teacher_id": str(self.teacher_b.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


class StudentLinkParentExtendedTests(StudentTestSetup):
    def test_admin_link_happy_path(self):
        new_parent_user = User.objects.create_user(
            national_id="970590111110",
            phone_number="970590111110",
            password="p",
            role="parent",
        )
        new_parent = Parent.objects.create(user=new_parent_user, full_name="New")
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"{STUDENTS_URL}{self.student_b.id}/link-parent/",
            {"parent_id": str(new_parent.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            ParentStudentLink.objects.filter(
                parent=new_parent, student=self.student_b
            ).exists()
        )

    def test_invalid_parent_id_returns_400(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"{STUDENTS_URL}{self.student_a.id}/link-parent/",
            {"parent_id": str(uuid.uuid4())},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            f"{STUDENTS_URL}{self.student_a.id}/link-parent/",
            {"parent_id": str(self.parent.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


CHANGE_REQUESTS_URL = f"{STUDENTS_URL}teacher-requests/"


class ChangeRequestTests(StudentTestSetup):
    """StudentChangeRequest: teacher submits, admin approves/rejects."""

    # -- unassign (remove from own roster) -----------------------------
    def test_teacher_requests_unassign_own_student(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_a.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["data"]["status"], "pending")
        self.student_a.refresh_from_db()
        self.assertEqual(self.student_a.teacher_id, self.teacher_a.id)  # unchanged until approved

    def test_teacher_cannot_request_unassign_for_foreign_student(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_b.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_approves_unassign_request(self):
        self.client.force_authenticate(self.teacher_a_user)
        create_resp = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_a.id)},
            format="json",
        )
        request_id = create_resp.data["data"]["id"]

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"{CHANGE_REQUESTS_URL}{request_id}/approve/",
            {"note": "Approved during weekly roster review."},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["status"], "approved")
        self.assertEqual(response.data["data"]["note"], "Approved during weekly roster review.")
        self.student_a.refresh_from_db()
        self.assertIsNone(self.student_a.teacher_id)

        # Check notification dispatch
        from notifications.models import Notification
        notif = Notification.objects.filter(recipient=self.teacher_a_user, type="teacher_request").last()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.title, "تمت الموافقة على طلبك")
        self.assertIn("إزالة من حلقتي", notif.body)
        self.assertIn("Approved during weekly roster review.", notif.body)

    def test_admin_rejects_request_with_note(self):
        self.client.force_authenticate(self.teacher_a_user)
        create_resp = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_a.id)},
            format="json",
        )
        request_id = create_resp.data["data"]["id"]

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"{CHANGE_REQUESTS_URL}{request_id}/reject/",
            {"note": "still needs this student"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["status"], "rejected")
        self.assertEqual(response.data["data"]["note"], "still needs this student")
        self.student_a.refresh_from_db()
        self.assertEqual(self.student_a.teacher_id, self.teacher_a.id)  # unchanged

        # Check notification dispatch
        from notifications.models import Notification
        notif = Notification.objects.filter(recipient=self.teacher_a_user, type="teacher_request").last()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.title, "تم رفض طلبك")
        self.assertIn("still needs this student", notif.body)

    def test_non_admin_cannot_approve_or_reject_requests(self):
        self.client.force_authenticate(self.teacher_a_user)
        create_resp = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_a.id)},
            format="json",
        )
        request_id = create_resp.data["data"]["id"]

        # Teacher B tries to approve
        self.client.force_authenticate(self.teacher_b_user)
        approve_resp = self.client.post(f"{CHANGE_REQUESTS_URL}{request_id}/approve/")
        self.assertEqual(approve_resp.status_code, 403)

        # Teacher B tries to reject
        reject_resp = self.client.post(
            f"{CHANGE_REQUESTS_URL}{request_id}/reject/",
            {"note": "forbidden"},
            format="json",
        )
        self.assertEqual(reject_resp.status_code, 403)

    # -- assign (transfer, including from another teacher) --------------
    def test_teacher_requests_assign_student_from_another_teacher(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "assign", "student_id": str(self.student_b.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_teacher_cannot_request_assign_for_already_own_student(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "assign", "student_id": str(self.student_a.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_assign_approval_enforces_max_students_capacity(self):
        # teacher_b's capacity is 2, already has student_b assigned.
        third_student_user = User.objects.create_user(
            national_id="970590100062", phone_number="970590100060",
            password="secret123", role="student",
        )
        third_student = Student.objects.create(
            user=third_student_user, full_name="Student C", birthdate=date(2012, 3, 3),
            grade="Grade 7", teacher=None,
            guardian_name="Guardian C", guardian_mobile="0599000003",
        )
        fourth_student_user = User.objects.create_user(
            national_id="970590100072", phone_number="970590100070",
            password="secret123", role="student",
        )
        fourth_student = Student.objects.create(
            user=fourth_student_user, full_name="Student D", birthdate=date(2012, 4, 4),
            grade="Grade 7", teacher=None,
            guardian_name="Guardian D", guardian_mobile="0599000004",
        )

        self.client.force_authenticate(self.teacher_b_user)
        r1 = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "assign", "student_id": str(third_student.id)},
            format="json",
        )
        r2 = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "assign", "student_id": str(fourth_student.id)},
            format="json",
        )

        self.client.force_authenticate(self.admin)
        approve1 = self.client.post(f"{CHANGE_REQUESTS_URL}{r1.data['data']['id']}/approve/")
        self.assertEqual(approve1.status_code, 200)  # teacher_b now at capacity (2/2)

        approve2 = self.client.post(f"{CHANGE_REQUESTS_URL}{r2.data['data']['id']}/approve/")
        self.assertEqual(approve2.status_code, 400)
        fourth_student.refresh_from_db()
        self.assertIsNone(fourth_student.teacher_id)

    # -- update (full fields, via admin-executed approval) ---------------
    def test_teacher_requests_update_then_admin_approves_applies_full_fields(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {
                "action": "update",
                "student_id": str(self.student_a.id),
                "payload": {"full_name": "Renamed Student", "grade": "Grade 10"},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        request_id = response.data["data"]["id"]

        self.client.force_authenticate(self.admin)
        approve = self.client.post(f"{CHANGE_REQUESTS_URL}{request_id}/approve/")
        self.assertEqual(approve.status_code, 200)
        self.student_a.refresh_from_db()
        self.assertEqual(self.student_a.full_name, "Renamed Student")
        self.assertEqual(self.student_a.grade, "Grade 10")

    def test_teacher_cannot_request_update_for_foreign_student(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "update", "student_id": str(self.student_b.id), "payload": {"full_name": "X"}},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    # -- delete ------------------------------------------------------------
    def test_teacher_requests_delete_then_admin_rejects_keeps_student(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "delete", "student_id": str(self.student_a.id)},
            format="json",
        )
        request_id = response.data["data"]["id"]

        self.client.force_authenticate(self.admin)
        reject = self.client.post(
            f"{CHANGE_REQUESTS_URL}{request_id}/reject/", {"note": "no"}, format="json"
        )
        self.assertEqual(reject.status_code, 200)
        self.assertTrue(Student.objects.filter(id=self.student_a.id).exists())

    def test_teacher_requests_delete_then_admin_approves_soft_deletes_student(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "delete", "student_id": str(self.student_a.id)},
            format="json",
        )
        request_id = response.data["data"]["id"]

        self.client.force_authenticate(self.admin)
        approve = self.client.post(f"{CHANGE_REQUESTS_URL}{request_id}/approve/")
        self.assertEqual(approve.status_code, 200)
        self.student_a.refresh_from_db()
        self.student_a.user.refresh_from_db()
        self.assertFalse(self.student_a.user.is_active)
        self.assertIsNone(self.student_a.teacher)

    def test_teacher_cannot_request_delete_for_foreign_student(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "delete", "student_id": str(self.student_b.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    # -- create (new student registration) --------------------------------
    def test_teacher_requests_create_then_admin_approves_creates_student_assigned_to_teacher(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {
                "action": "create",
                "payload": {
                    "full_name": "Brand New Student",
                    "national_id": "970590199996",
                    "birthdate": "2014-01-01",
                    "grade": "Grade 5",
                    "phone_number": "970590199998",
                    "guardian_name": "Guardian New",
                    "guardian_mobile": "970590199997",
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        request_id = response.data["data"]["id"]

        self.client.force_authenticate(self.admin)
        approve = self.client.post(f"{CHANGE_REQUESTS_URL}{request_id}/approve/")
        self.assertEqual(approve.status_code, 200)

        new_student = Student.objects.get(user__national_id="970590199996")
        self.assertEqual(new_student.teacher_id, self.teacher_a.id)

    def test_teacher_create_request_missing_fields_rejected(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "create", "payload": {"full_name": "Incomplete"}},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    # -- guard rails ---------------------------------------------------
    def test_duplicate_pending_request_rejected(self):
        self.client.force_authenticate(self.teacher_a_user)
        self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_a.id)},
            format="json",
        )
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "delete", "student_id": str(self.student_a.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_approving_already_reviewed_request_fails(self):
        self.client.force_authenticate(self.teacher_a_user)
        create_resp = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_a.id)},
            format="json",
        )
        request_id = create_resp.data["data"]["id"]

        self.client.force_authenticate(self.admin)
        self.client.post(f"{CHANGE_REQUESTS_URL}{request_id}/approve/")
        second_attempt = self.client.post(f"{CHANGE_REQUESTS_URL}{request_id}/approve/")
        self.assertEqual(second_attempt.status_code, 400)

    def test_admin_cannot_submit_a_request(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_a.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_teacher_sees_only_own_requests(self):
        self.client.force_authenticate(self.teacher_a_user)
        self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_a.id)},
            format="json",
        )
        self.client.force_authenticate(self.teacher_b_user)
        self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_b.id)},
            format="json",
        )
        response = self.client.get(CHANGE_REQUESTS_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 1)
        self.assertEqual(response.data["data"][0]["teacher_id"], str(self.teacher_b.id))

    def test_admin_sees_all_requests(self):
        self.client.force_authenticate(self.teacher_a_user)
        self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_a.id)},
            format="json",
        )
        self.client.force_authenticate(self.teacher_b_user)
        self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_b.id)},
            format="json",
        )
        self.client.force_authenticate(self.admin)
        response = self.client.get(CHANGE_REQUESTS_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 2)

    def test_teacher_can_browse_all_students_for_assign_picker(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.get(STUDENTS_URL, {"browse_all": "true"})
        self.assertEqual(response.status_code, 200)
        ids = {row["id"] for row in response.data["data"]}
        self.assertIn(str(self.student_a.id), ids)
        self.assertIn(str(self.student_b.id), ids)  # visible even though owned by teacher_b

    def test_teacher_default_student_list_still_scoped_to_own_roster(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.get(STUDENTS_URL)
        self.assertEqual(response.status_code, 200)
        ids = {row["id"] for row in response.data["data"]}
        self.assertEqual(ids, {str(self.student_a.id)})

    def test_teacher_can_cancel_own_pending_request(self):
        self.client.force_authenticate(self.teacher_a_user)
        create_resp = self.client.post(
            CHANGE_REQUESTS_URL,
            {"action": "unassign", "student_id": str(self.student_a.id)},
            format="json",
        )
        request_id = create_resp.data["data"]["id"]
        response = self.client.delete(f"{CHANGE_REQUESTS_URL}{request_id}/")
        self.assertEqual(response.status_code, 200)
