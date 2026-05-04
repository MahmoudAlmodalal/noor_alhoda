from django.test import TestCase

from accounts.models import StaffMember, User
from students.selectors.import_selectors import teacher_find_by_loose_name
from teacher.models import Teacher
from teacher.services.excel_import.orchestrator import staff_excel_bulk_import


class TeacherBulkImportTests(TestCase):
    """Acceptance tests for the staff (هيكلية) bulk-import flow."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            national_id="900000001",
            password="x",
            role="admin",
            first_name="مدير",
            last_name="النظام",
        )

    def _row(self, **overrides):
        base = {
            "full_name": "محمد يونس محمد النحال",
            "national_id": "407831254",
            "phone_number": "0595580802",
            "birthdate": "15/10/2001",
            "wallet_name": "محمد النحال",
            "wallet_number": "567706261",
            "marital_status": "أعزب",
            "education_qualification": "بكالوريوس",
            "last_tajweed_course": "سند",
            "family_members_count": "",
            "job_title": "محفظ",
        }
        base.update(overrides)
        return base

    def test_director_creates_staff_member_not_teacher(self):
        result = staff_excel_bulk_import(
            creator=self.admin,
            rows=[
                self._row(
                    full_name="عبد الطيف بكر زغرة",
                    national_id="410142087",
                    phone_number="0592700429",
                    job_title="مدير المركز",
                    marital_status="متزوج",
                    family_members_count="7",
                    birthdate="",
                    education_qualification="",
                    last_tajweed_course="",
                ),
            ],
        )

        self.assertEqual(result["created_count"], 1)
        self.assertEqual(result["error_count"], 0, result["errors"])
        self.assertEqual(StaffMember.objects.count(), 1)
        self.assertEqual(Teacher.objects.count(), 0)

        director = StaffMember.objects.get()
        self.assertEqual(director.full_name, "عبد الطيف بكر زغرة")
        self.assertEqual(director.job_title, StaffMember.JobTitle.DIRECTOR)
        self.assertEqual(director.marital_status, "married")
        self.assertEqual(director.family_members_count, 7)

    def test_supplementary_teacher_gets_synthetic_99_national_id(self):
        result = staff_excel_bulk_import(
            creator=self.admin,
            rows=[
                self._row(
                    full_name="طه نبهان",
                    national_id="",
                    phone_number="",
                    birthdate="",
                    wallet_name="",
                    wallet_number="",
                    marital_status="",
                    education_qualification="",
                    last_tajweed_course="",
                    job_title="مساعد محفظ",
                ),
            ],
        )

        self.assertEqual(result["error_count"], 0, result["errors"])
        self.assertEqual(result["created_count"], 1)
        teacher = Teacher.objects.get()
        self.assertTrue(
            teacher.user.national_id.startswith("99"),
            f"expected 99-prefixed synthetic id, got {teacher.user.national_id}",
        )
        self.assertEqual(len(teacher.user.national_id), 12)
        self.assertEqual(teacher.job_title, Teacher.JobTitle.TEACHER_ASSISTANT)

    def test_idempotent_rerun_does_not_duplicate(self):
        rows = [self._row()]

        first = staff_excel_bulk_import(creator=self.admin, rows=rows)
        second = staff_excel_bulk_import(creator=self.admin, rows=rows)

        self.assertEqual(first["created_count"], 1)
        self.assertEqual(second["created_count"], 0)
        self.assertEqual(second["updated_count"], 1)
        self.assertEqual(second["error_count"], 0, second["errors"])
        self.assertEqual(Teacher.objects.count(), 1)

    def test_fuzzy_match_resolves_short_sheikh_name(self):
        # Seed a full quadrinominal teacher via the staff import.
        staff_excel_bulk_import(
            creator=self.admin,
            rows=[self._row(full_name="محمد يونس محمد النحال", national_id="407831254")],
        )

        # The student importer would query with the abbreviated form.
        match = teacher_find_by_loose_name(name="محمد النحال")
        self.assertIsNotNone(match)
        self.assertEqual(match.full_name, "محمد يونس محمد النحال")

        # And a single-token query should NOT match (too ambiguous).
        self.assertIsNone(teacher_find_by_loose_name(name="محمد"))

    def test_fuzzy_match_returns_none_when_two_teachers_share_first_and_last_token(self):
        """Disambiguation guard: when two teachers share both the first and
        last name token, the loose match must return None rather than pick
        one arbitrarily."""
        staff_excel_bulk_import(
            creator=self.admin,
            rows=[
                self._row(full_name="محمد علي حسن النحال", national_id="411111111"),
                self._row(full_name="محمد جهاد سامي النحال", national_id="422222222"),
            ],
        )

        match = teacher_find_by_loose_name(name="محمد النحال")
        self.assertIsNone(match)

    def test_fuzzy_match_handles_empty_and_whitespace(self):
        self.assertIsNone(teacher_find_by_loose_name(name=""))
        self.assertIsNone(teacher_find_by_loose_name(name="   "))

    def test_unknown_job_title_is_reported_as_error(self):
        result = staff_excel_bulk_import(
            creator=self.admin,
            rows=[
                self._row(
                    full_name="مجهول الوظيفة",
                    national_id="123456789",
                    job_title="منسق فعاليات",
                ),
            ],
        )

        self.assertEqual(result["created_count"], 0)
        self.assertEqual(result["error_count"], 1)
        self.assertIn("المسمى", result["errors"][0]["message"])

    def test_media_role_lands_in_staff_member_with_synthetic_id(self):
        result = staff_excel_bulk_import(
            creator=self.admin,
            rows=[
                self._row(
                    full_name="خالد زغرة",
                    national_id="",
                    phone_number="",
                    birthdate="",
                    wallet_name="",
                    wallet_number="",
                    marital_status="",
                    education_qualification="",
                    last_tajweed_course="",
                    job_title="اعلامي",
                ),
            ],
        )

        self.assertEqual(result["created_count"], 1)
        self.assertEqual(StaffMember.objects.count(), 1)
        media = StaffMember.objects.get()
        self.assertEqual(media.job_title, StaffMember.JobTitle.MEDIA)
        self.assertTrue(media.national_id.startswith("99"))
