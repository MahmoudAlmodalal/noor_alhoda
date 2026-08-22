from datetime import date

from django.test import TestCase

from accounts.models import User
from evaluations.models import Evaluation
from evaluations.services.evaluation_services import evaluation_create, evaluation_update
from students.models import Student


class EvaluationMonthAndGradingDateTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            national_id="6100000001",
            phone_number="0596100001",
            password="adminpass",
            role="admin",
        )
        student_user = User.objects.create_user(
            national_id="6100000002",
            phone_number="0596100002",
            password="studentpass",
            role="student",
        )
        self.student = Student.objects.create(
            user=student_user,
            full_name="طالب اختبار الشهر",
            birthdate=date(2012, 1, 1),
            grade="السادس",
        )

    def test_scheduled_date_is_normalized_to_selected_month(self):
        evaluation = evaluation_create(
            student_id=self.student.id,
            title="اختبار شهر آب",
            scheduled_date=date(2026, 8, 18),
            actor=self.admin,
        )

        self.assertEqual(evaluation.scheduled_date, date(2026, 8, 1))
        self.assertIsNone(evaluation.evaluated_date)

    def test_grading_records_the_actual_day(self):
        evaluation = evaluation_create(
            student_id=self.student.id,
            title="اختبار شهر آب",
            scheduled_date=date(2026, 8, 1),
            actor=self.admin,
        )

        updated = evaluation_update(
            evaluation=evaluation,
            data={"status": Evaluation.Status.PASSED, "score": "90"},
            actor=self.admin,
        )

        self.assertEqual(updated.evaluated_date, date.today())

    def test_explicit_offline_grading_date_is_preserved(self):
        evaluation = evaluation_create(
            student_id=self.student.id,
            title="اختبار شهر آب",
            scheduled_date=date(2026, 8, 1),
            actor=self.admin,
        )
        grading_date = date(2026, 8, 18)

        updated = evaluation_update(
            evaluation=evaluation,
            data={
                "status": Evaluation.Status.PASSED,
                "score": "90",
                "evaluated_date": grading_date,
            },
            actor=self.admin,
        )

        self.assertEqual(updated.evaluated_date, grading_date)
