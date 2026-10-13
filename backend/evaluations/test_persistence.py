from datetime import date
from decimal import Decimal
from uuid import uuid4

from rest_framework.test import APITestCase

from accounts.models import User
from evaluations.models import Evaluation
from records.models import DailyRecord, WeeklyPlan
from students.models import Student
from teacher.models import Teacher


class PersistenceRegressionTests(APITestCase):
    def setUp(self):
        self.teacher_user = User.objects.create_user(national_id="save-teacher", password="test", role="teacher")
        self.teacher = Teacher.objects.create(user=self.teacher_user, full_name="المعلم")
        self.other_user = User.objects.create_user(national_id="save-other", password="test", role="teacher")
        Teacher.objects.create(user=self.other_user, full_name="معلم آخر")
        self.student_user = User.objects.create_user(national_id="save-student", password="test", role="student")
        self.student = Student.objects.create(user=self.student_user, teacher=self.teacher, full_name="الطالب", birthdate=date(2012, 1, 1), grade="السادس")
        self.client.force_authenticate(self.teacher_user)

    def push(self, resource, action, record_id, data, base=None, op_id=None):
        response = self.client.post("/api/sync/push/", {"ops": [{
            "client_id": str(op_id or uuid4()), "resource": resource, "op": action,
            "id": str(record_id), "data": data, "base_updated_at": base,
        }]}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["data"]["results"][0]

    def create_evaluation(self):
        record_id = uuid4()
        result = self.push("evaluation", "create", record_id, {
            "student_id": str(self.student.id), "title": "اختبار", "scheduled_date": "2026-10-01",
        })
        self.assertEqual(result["status"], "synced", result)
        return Evaluation.objects.get(id=record_id)

    def test_create_grade_90_reload_regrade_and_no_duplicates(self):
        evaluation = self.create_evaluation()
        op_id = uuid4()
        data = {"status": "passed", "score": "90", "result_note": "ممتاز", "evaluated_date": "2026-10-13"}
        for _ in range(2):
            result = self.push("evaluation", "update", evaluation.id, data, evaluation.updated_at.isoformat(), op_id)
            self.assertEqual(result["status"], "synced", result)
        evaluation.refresh_from_db()
        self.assertEqual(evaluation.score, Decimal("90"))
        response = self.client.get(f"/api/evaluations/?student_id={self.student.id}")
        self.assertEqual(response.data["data"][0]["score"], "90.00")
        result = self.push("evaluation", "update", evaluation.id, {"status": "failed", "score": "75", "result_note": "تصحيح"}, evaluation.updated_at.isoformat())
        self.assertEqual(result["status"], "synced", result)
        evaluation.refresh_from_db()
        self.assertEqual(evaluation.score, Decimal("75"))
        self.assertEqual(evaluation.evaluated_date, date(2026, 10, 13))
        self.assertEqual(Evaluation.objects.count(), 1)

    def test_historical_evaluation_without_creator_can_be_edited(self):
        evaluation = Evaluation.objects.create(student=self.student, title="قديم", scheduled_date=date(2021, 5, 18), evaluated_date=date(2021, 5, 20), status="passed", score=80, created_by=None)
        response = self.client.patch(f"/api/evaluations/{evaluation.id}/", {"score": "90", "status": "passed", "result_note": "تصحيح مصرح"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        evaluation.refresh_from_db()
        self.assertEqual(evaluation.score, Decimal("90"))
        self.assertEqual(evaluation.scheduled_date, date(2021, 5, 18))
        self.assertEqual(evaluation.evaluated_date, date(2021, 5, 20))
        self.assertIsNone(evaluation.created_by)
        self.assertEqual(Evaluation.objects.count(), 1)

    def test_attendance_create_update_and_historical_update_persist(self):
        record_id = uuid4()
        payload = {"student_id": str(self.student.id), "date": "2021-05-18", "day": "tue", "attendance": "present", "memorized_lines": 45, "review_lines": 105}
        op_id = uuid4()
        for _ in range(2):
            result = self.push("daily_record", "create", record_id, payload, op_id=op_id)
            self.assertEqual(result["status"], "synced", result)
        record = DailyRecord.objects.get(id=record_id)
        result = self.push("daily_record", "update", record_id, {"attendance": "excused", "memorized_lines": 30, "review_lines": 90}, record.updated_at.isoformat())
        self.assertEqual(result["status"], "synced", result)
        record.refresh_from_db()
        self.assertEqual((record.attendance, record.memorized_lines, record.review_lines), ("excused", 30, 90))
        self.assertEqual(DailyRecord.objects.count(), 1)

    def test_validation_permissions_and_conflicts_do_not_change_grade(self):
        evaluation = self.create_evaluation()
        base = evaluation.updated_at.isoformat()
        for data in [{"score": "101"}, {"score": "-1"}, {"status": "invalid"}]:
            result = self.push("evaluation", "update", evaluation.id, data, base)
            self.assertEqual(result["status"], "error", result)
            self.assertEqual(result["error"]["code"], "validation")
        for actor in [self.other_user, self.student_user]:
            self.client.force_authenticate(actor)
            result = self.push("evaluation", "update", evaluation.id, {"score": "90"}, base)
            self.assertEqual(result["error"]["code"], "forbidden", result)
        self.client.force_authenticate(self.teacher_user)
        result = self.push("evaluation", "update", evaluation.id, {"score": "90"}, "2020-01-01T00:00:00Z")
        self.assertEqual(result["status"], "conflict")
        evaluation.refresh_from_db()
        self.assertIsNone(evaluation.score)

    def test_page_workloads_agree_across_stats_history_summary_and_updates(self):
        from records.selectors.record_selectors import monthly_summary
        from students.selectors.student_selectors import student_stats, monthly_history_for_student
        today = date.today()
        month = today.replace(day=1)
        plan = WeeklyPlan.objects.create(student=self.student, month_start=month, week_start=month, required_pages=5, review_required_pages=10)
        record = DailyRecord.objects.create(student=self.student, weekly_plan=plan, date=today, day="tue", attendance="present", memorized_lines=45, review_lines=105, required_verses=999)
        # Multiple tests must not multiply the pages from a single daily log.
        self.create_evaluation()
        self.create_evaluation()
        def assert_progress(completed=3, revision=7):
            expected = {"has_assignment": True, "memorization": {"required": 5, "completed": completed, "remaining": max(0, 5-completed), "percentage": min(100, completed/5*100)}, "revision": {"required": 10, "completed": revision, "remaining": max(0, 10-revision), "percentage": min(100, revision/10*100)}}
            history = monthly_history_for_student(student=self.student)[0]
            summary = monthly_summary(student_id=self.student.id, month_start=month, actor=self.teacher_user)
            stats = student_stats(student_id=self.student.id, actor=self.teacher_user)
            for result in [history, summary, stats]:
                self.assertEqual(result["page_progress"], expected)
        assert_progress()
        result = self.push("daily_record", "update", record.id, {"memorized_lines": 60, "review_lines": 120}, record.updated_at.isoformat())
        self.assertEqual(result["status"], "synced", result)
        assert_progress(4, 8)
        result = self.push("weekly_plan", "update", plan.id, {"required_pages": 0, "review_required_pages": 0}, WeeklyPlan.objects.get(id=plan.id).updated_at.isoformat())
        self.assertEqual(result["status"], "synced", result)
        progress = student_stats(student_id=self.student.id, actor=self.teacher_user)["page_progress"]
        for category in ["memorization", "revision"]:
            self.assertEqual(progress[category]["remaining"], 0)
            self.assertEqual(progress[category]["percentage"], 0)

    def test_attendance_only_edit_does_not_overwrite_a_regraded_exam(self):
        evaluation = self.create_evaluation()
        record_id = uuid4()
        result = self.push("daily_record", "create", record_id, {
            "student_id": str(self.student.id), "date": "2026-10-13", "day": "tue", "attendance": "present",
            "evaluation_id": str(evaluation.id), "scattered_test_score": 90,
        })
        self.assertEqual(result["status"], "synced", result)
        evaluation.refresh_from_db()
        self.assertEqual(evaluation.evaluated_date, date(2026, 10, 13))
        result = self.push("evaluation", "update", evaluation.id, {"score": "70", "status": "failed"}, evaluation.updated_at.isoformat())
        self.assertEqual(result["status"], "synced", result)
        record = DailyRecord.objects.get(id=record_id)
        result = self.push("daily_record", "update", record.id, {"attendance": "excused", "note": "حضور فقط"}, record.updated_at.isoformat())
        self.assertEqual(result["status"], "synced", result)
        evaluation.refresh_from_db()
        self.assertEqual(evaluation.score, Decimal("70"))

    def test_unassigned_logs_are_visible_without_invented_page_targets(self):
        from records.selectors.record_selectors import monthly_summary
        from students.selectors.student_selectors import student_stats
        today = date.today()
        DailyRecord.objects.create(student=self.student, date=today, day="tue", attendance="present", required_verses=150, memorized_lines=30, review_from_page=10, review_to_page=12)
        for result in [student_stats(student_id=self.student.id, actor=self.teacher_user), monthly_summary(student_id=self.student.id, month_start=today.replace(day=1), actor=self.teacher_user)]:
            progress = result["page_progress"]
            self.assertFalse(progress["has_assignment"])
            self.assertEqual(progress["memorization"], {"required": 0, "completed": 2, "remaining": 0, "percentage": 0})
            self.assertEqual(progress["revision"], {"required": 0, "completed": 3, "remaining": 0, "percentage": 0})
