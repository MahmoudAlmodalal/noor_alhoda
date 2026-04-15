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
            national_id="970590100030",
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
            guardian_name="Guardian A",
            guardian_mobile="0599000001",
        )

        # Student B (belongs to teacher B)
        self.student_b_user = User.objects.create_user(
            national_id="970590100040",
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
                "national_id": "NEW-001",
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
    def test_admin_hard_deletes_student(self):
        """STU-11 / Feature 2.5: Hard-delete removes student and user."""
        self.client.force_authenticate(self.admin)
        student_id = self.student_a.id
        user_id = self.student_a.user.id
        response = self.client.delete(f"/api/students/{student_id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Student.objects.filter(id=student_id).exists())
        self.assertFalse(User.objects.filter(id=user_id).exists())

    def test_admin_assigns_teacher_respects_max_students(self):
        """STU-12 / Feature 2.4: Assign teacher checks max_students limit."""
        # Teacher B has max_students=2, already has 1 student
        extra_user = User.objects.create_user(
            national_id="970590100060",
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
        response = self.client.get(STUDENTS_URL + "?search=STU-B-001")
        self.assertEqual(response.status_code, 200)
        results = response.data["data"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["national_id"], "STU-B-001")

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
                national_id=f"970590200{idx:03d}",
                phone_number=f"0599200{idx:03d}"[:10],
                password="secret123",
                role="student",
            )
            Student.objects.create(
                user=extra_user,
                full_name=f"Student Extra {idx}",
                national_id=f"STU-EX-{idx:03d}",
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
            "national_id": "CT-001",
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
                national_id="CT-OPT-1",
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
        student = Student.objects.get(national_id="CT-OPT-1")
        self.assertEqual(student.bank_account_number, "123")
        self.assertEqual(student.health_status, "sick")
        self.assertEqual(student.skills.get("quran"), True)

    def test_missing_required_full_name_rejected(self):
        self.client.force_authenticate(self.admin)
        payload = self._valid_payload(national_id="CT-002")
        del payload["full_name"]
        response = self.client.post(STUDENT_CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_missing_guardian_mobile_rejected(self):
        self.client.force_authenticate(self.admin)
        payload = self._valid_payload(national_id="CT-003")
        del payload["guardian_mobile"]
        response = self.client.post(STUDENT_CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_invalid_teacher_id_rejected(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            STUDENT_CREATE_URL,
            self._valid_payload(
                national_id="CT-004",
                teacher_id=str(uuid.uuid4()),
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_unauthenticated_create_401(self):
        response = self.client.post(
            STUDENT_CREATE_URL,
            self._valid_payload(national_id="CT-005"),
            format="json",
        )
        self.assertEqual(response.status_code, 401)


class StudentBulkCreateTests(StudentTestSetup):
    def _row(self, **overrides):
        row = {
            "national_id": "BULK-001",
            "full_name": "Bulk Student",
            "birthdate": "10/10/2013",
            "grade": "7",
            "guardian_name": "Parent",
            "guardian_mobile": "0599912345",
            "guardian_national_id": "G-BULK-001",
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
        student = Student.objects.get(national_id="BULK-001")
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
        self.assertTrue(
            Student.objects.filter(national_id__startswith="NOID-").exists()
        )

    def test_teacher_auto_resolve_existing_by_name(self):
        self.client.force_authenticate(self.admin)
        self.client.post(
            STUDENT_BULK_CREATE_URL,
            {"rows": [self._row(national_id="BULK-T1")]},
            format="json",
        )
        student = Student.objects.get(national_id="BULK-T1")
        self.assertEqual(student.teacher, self.teacher_a)

    def test_teacher_auto_create_when_missing(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            STUDENT_BULK_CREATE_URL,
            {"rows": [self._row(national_id="BULK-T2", teacher_name="New Bulk Teacher")]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Teacher.objects.filter(full_name__iexact="New Bulk Teacher").exists())

    def test_row_level_errors_collected_without_aborting(self):
        self.client.force_authenticate(self.admin)
        good = self._row(national_id="BULK-OK-1")
        bad = self._row(national_id="BULK-BAD-1", birthdate="not-a-date")
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
                        national_id="BULK-AFF-1",
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
                        national_id="BULK-SKILLS-1",
                        skills="قراءة القرآن/ انشاد/ كرة قدم",
                    )
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        student = Student.objects.get(national_id="BULK-SKILLS-1")
        self.assertTrue(student.skills["quran"])
        self.assertTrue(student.skills["nasheed"])
        self.assertTrue(student.skills["other"])
        self.assertIn("كرة قدم", student.skills["other_text"])

    def test_reimport_repairs_existing_student_and_course_aliases(self):
        alias_course = Course.objects.create(name="النوارنية", description="")
        placeholder_course = Course.objects.create(name="لايوجد", description="")
        existing_user = User.objects.create_user(
            national_id="970590100080",
            phone_number="0599100080",
            password="secret123",
            role="student",
        )
        existing_student = Student.objects.create(
            user=existing_user,
            full_name="Existing Bulk Student",
            national_id="BULK-EXIST-1",
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
                        national_id="BULK-EXIST-1",
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
            {"rows": [self._row(national_id="BULK-NO-COURSE", desired_courses="لايوجد")]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(Course.objects.filter(name__iexact="لايوجد").exists())


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

    def test_teacher_limited_to_health_note_and_skills(self):
        self.client.force_authenticate(self.teacher_a_user)
        response = self.client.patch(
            f"{STUDENTS_URL}{self.student_a.id}/",
            {"health_note": "follow-up", "skills": {"quran": True}},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.student_a.refresh_from_db()
        self.assertEqual(self.student_a.health_note, "follow-up")
        self.assertEqual(self.student_a.skills.get("quran"), True)

    def test_teacher_attempt_to_edit_name_is_ignored(self):
        self.client.force_authenticate(self.teacher_a_user)
        original_name = self.student_a.full_name
        self.client.patch(
            f"{STUDENTS_URL}{self.student_a.id}/",
            {"full_name": "Hijacked", "health_note": "ok"},
            format="json",
        )
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

    def test_delete_cascades_to_linked_user(self):
        self.client.force_authenticate(self.admin)
        user_id = self.student_a.user.id
        self.client.delete(f"{STUDENTS_URL}{self.student_a.id}/")
        self.assertFalse(User.objects.filter(id=user_id).exists())
        self.assertFalse(Student.objects.filter(id=self.student_a.id).exists())


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
