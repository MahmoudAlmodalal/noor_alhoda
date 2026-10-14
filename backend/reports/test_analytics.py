from datetime import date, timedelta
from decimal import Decimal
import re
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from accounts.models import User
from teacher.models import Teacher
from students.models import Student
from records.models import DailyRecord, WeeklyPlan, ReviewRecord
from progress.models import StudentProgress
from evaluations.models import Evaluation
from reports.services.analytics import Coverage, teacher_dataset


class TeacherAnalyticsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            national_id="analytics-admin", role="admin"
        )
        cls.teacher_user = User.objects.create_user(
            national_id="analytics-teacher", role="teacher", first_name="محفّظ"
        )
        cls.teacher = Teacher.objects.create(
            user=cls.teacher_user, full_name="المحفّظ الأول", ring_name="حلقة النور"
        )
        cls.other = Teacher.objects.create(
            user=User.objects.create_user(
                national_id="analytics-other", role="teacher"
            ),
            full_name="المحفّظ السابق",
        )
        cls.student = Student.objects.create(
            user=User.objects.create_user(
                national_id="analytics-student", role="student"
            ),
            teacher=cls.teacher,
            full_name="طالب أول",
            birthdate=date(2012, 1, 1),
            grade="5",
        )
        cls.second = Student.objects.create(
            user=User.objects.create_user(
                national_id="analytics-second", role="student", is_active=False
            ),
            teacher=cls.teacher,
            full_name="طالب ثان",
            birthdate=date(2012, 1, 1),
            grade="5",
        )
        cls.plan = WeeklyPlan.objects.create(
            student=cls.student,
            week_start=date(2026, 1, 1),
            month_start=date(2026, 1, 1),
            required_pages=10,
            review_required_pages=8,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.base = f"/api/reports/teachers/{self.teacher.id}/analytics/"
        self.detail = f"/api/reports/teachers/{self.teacher.id}/students/{self.student.id}/analytics/"
        self.filters = {
            "from": date(2026, 1, 1),
            "to": date(2026, 1, 31),
            "group_by": "month",
        }
        self.query = {"period": "custom", "from": "2026-01-01", "to": "2026-01-31"}

    def daily(self, day, **fields):
        return DailyRecord.objects.create(
            student=self.student,
            date=day,
            day="sat",
            recorded_by=self.teacher_user,
            **fields,
        )

    def result(self):
        return self.client.get(self.detail, self.query).data["data"]

    def test_absent_without_recitation_is_not_memorization_activity(self):
        self.daily(
            date(2026, 1, 3), surah_name="الحاقة", attendance="absent", quality="none"
        )
        self.assertEqual(self.result()["memorization_history"], [])
        self.assertEqual(self.result()["sessions"]["memorization"], 0)
        self.assertEqual(self.result()["attendance"]["absent"], 1)

    def test_overlapping_and_repeated_page_ranges_count_once(self):
        self.daily(
            date(2026, 1, 2),
            surah_name="البقرة",
            from_page=2,
            to_page=4,
            memorized_lines=45,
        )
        self.daily(
            date(2026, 1, 3),
            surah_name="البقرة",
            from_page=3,
            to_page=5,
            memorized_lines=45,
        )
        self.daily(
            date(2026, 1, 4),
            surah_name="البقرة",
            from_page=2,
            to_page=5,
            memorized_lines=60,
        )
        r = self.result()
        self.assertEqual(
            r["memorization"],
            {
                "required": 10,
                "completed": 4,
                "remaining": 6,
                "percentage": 40,
                "unquantified_sessions": 0,
                "has_target": True,
            },
        )
        self.assertEqual([e["new_pages"] for e in r["memorization_history"]], [3, 1, 0])
        self.assertEqual(r["cumulative"]["pages"], 4)

    def test_period_does_not_recount_old_memorization(self):
        self.daily(date(2025, 12, 25), from_page=2, to_page=4)
        self.daily(date(2026, 1, 5), from_page=3, to_page=5)
        r = self.result()
        self.assertEqual(r["memorization"]["completed"], 1)
        self.assertEqual(r["cumulative"]["pages"], 4)
        self.assertEqual(len(r["memorization_history"]), 1)

    def test_verse_union_and_progress_mirror_not_converted_to_pages(self):
        self.daily(date(2026, 1, 2), surah_name="البقرة", from_ayah=1, to_ayah=10)
        p = StudentProgress.objects.create(
            student=self.student,
            teacher=self.teacher,
            surah_number=2,
            surah_name="البقرة",
            juz_number=1,
            from_ayah=5,
            to_ayah=15,
        )
        StudentProgress.objects.filter(id=p.id).update(
            recorded_at=timezone.make_aware(timezone.datetime(2026, 1, 3))
        )
        r = self.result()
        self.assertEqual(r["cumulative"]["verses"], 15)
        self.assertEqual(r["memorization"]["completed"], 0)
        self.assertIsNone(r["memorization"]["percentage"])

    def test_unknown_lines_and_partial_pages_never_invent_unique_pages(self):
        self.daily(date(2026, 1, 2), memorized_lines=30)
        self.daily(date(2026, 1, 3), from_page=3, to_page=3, memorized_lines=5)
        r = self.result()
        self.assertEqual(r["memorization"]["completed"], 0)
        self.assertEqual(r["memorization"]["unquantified_sessions"], 2)
        self.assertIsNone(r["memorization"]["remaining"])

    def test_full_page_after_previous_partial_record_does_not_invent_new_work(self):
        self.daily(date(2025, 12, 20), from_page=2, to_page=2, memorized_lines=5)
        self.daily(date(2026, 1, 2), from_page=2, to_page=2, memorized_lines=15)
        r = self.result()
        self.assertEqual(r["memorization"]["completed"], 0)
        self.assertEqual(r["cumulative"]["pages"], 1)
        self.assertIsNone(r["memorization"]["percentage"])

    def test_disjoint_verse_line_records_use_existing_15_line_contract(self):
        self.daily(
            date(2026, 1, 2),
            surah_name="البقرة",
            from_ayah=1,
            to_ayah=10,
            memorized_lines=30,
        )
        self.daily(
            date(2026, 1, 3),
            surah_name="البقرة",
            from_ayah=1,
            to_ayah=10,
            memorized_lines=30,
        )
        self.daily(
            date(2026, 1, 4),
            surah_name="البقرة",
            from_ayah=11,
            to_ayah=20,
            memorized_lines=15,
        )
        self.assertEqual(self.result()["memorization"]["completed"], 3)

    def test_line_equivalents_are_summed_before_rounding(self):
        for i in range(15):
            self.daily(
                date(2026, 1, 1) + timedelta(days=i),
                surah_name="البقرة",
                from_ayah=i + 1,
                to_ayah=i + 1,
                memorized_lines=1,
                review_lines=1,
            )
        r = self.result()
        self.assertEqual(r["memorization"]["completed"], 1)
        self.assertEqual(r["revision"]["completed"], 1)
        self.assertEqual(r["cumulative"]["pages"], 1)

    def test_teacher_totals_do_not_sum_rounded_student_amounts(self):
        users = User.objects.bulk_create(
            [User(national_id=f"rounding-{i}", role="student") for i in range(15)]
        )
        students = Student.objects.bulk_create(
            [
                Student(
                    user=u,
                    teacher=self.teacher,
                    full_name=f"طالب {i}",
                    birthdate=date(2012, 1, 1),
                    grade="5",
                )
                for i, u in enumerate(users)
            ]
        )
        DailyRecord.objects.bulk_create(
            [
                DailyRecord(
                    student=s,
                    day="sat",
                    date=date(2026, 1, 2),
                    surah_name="البقرة",
                    from_ayah=1,
                    to_ayah=1,
                    memorized_lines=1,
                    review_lines=1,
                )
                for s in students
            ]
        )
        data = teacher_dataset(self.teacher.id, self.filters)
        self.assertEqual(data["summary"]["memorization"]["completed"], 1)
        self.assertEqual(data["summary"]["revision"]["completed"], 1)
        self.assertNotIn("_completed_exact", data["summary"]["memorization"])

    def test_unknown_chart_quantities_are_null_not_fabricated_zeroes(self):
        self.daily(date(2026, 1, 3), memorized_lines=5)
        row = self.result()["trends"][0]
        self.assertIsNone(row["memorization"])
        self.assertIsNone(row["revision"])
        self.assertEqual(row["attendance"], 100)

    def test_progress_at_local_midnight_belongs_to_gaza_calendar_day(self):
        p = StudentProgress.objects.create(
            student=self.student,
            teacher=self.teacher,
            surah_number=2,
            surah_name="البقرة",
            juz_number=1,
            from_ayah=1,
            to_ayah=5,
        )
        from datetime import datetime, timezone as datetime_timezone

        StudentProgress.objects.filter(id=p.id).update(
            recorded_at=datetime(2025, 12, 31, 22, 30, tzinfo=datetime_timezone.utc)
        )
        self.query.update({"from": "2026-01-01", "to": "2026-01-01"})
        r = self.result()
        self.assertEqual(len(r["memorization_history"]), 1)
        self.assertEqual(r["memorization_history"][0]["date"], "2026-01-01")

    def test_mixed_page_and_verse_units_do_not_double_count(self):
        self.daily(date(2026, 1, 2), surah_name="البقرة", from_page=2, to_page=3)
        self.daily(
            date(2026, 1, 3),
            surah_name="البقرة",
            from_ayah=1,
            to_ayah=10,
            memorized_lines=30,
        )
        r = self.result()
        self.assertEqual(r["memorization"]["completed"], 2)
        self.assertIsNone(r["memorization"]["percentage"])

    def test_revision_repeats_are_activity_and_separate_from_memorization(self):
        for day in (2, 3):
            self.daily(
                date(2026, 1, day),
                review_surah_name="الملك",
                review_from_page=562,
                review_to_page=563,
                review_lines=30,
            )
        r = self.result()
        self.assertEqual(r["revision"]["completed"], 4)
        self.assertEqual(r["memorization"]["completed"], 0)
        self.assertEqual(r["sessions"]["revision"], 2)

    def test_unknown_revision_does_not_mark_target_complete(self):
        ReviewRecord.objects.create(
            student=self.student, surah_name="الملك", reviewed_date=date(2026, 1, 3)
        )
        r = self.result()
        self.assertIsNone(r["revision"]["percentage"])
        self.assertEqual(r["revision"]["completed"], 0)

    def test_missing_targets_return_null_not_completed_or_division_by_zero(self):
        WeeklyPlan.objects.filter(student=self.student).delete()
        self.daily(date(2026, 1, 2), from_page=2, to_page=2)
        r = self.result()
        self.assertFalse(r["memorization"]["has_target"])
        self.assertIsNone(r["memorization"]["percentage"])
        self.assertIsNone(r["memorization"]["remaining"])
        self.assertEqual(r["memorization"]["completed"], 1)

    def test_overlapping_month_plan_not_prorated_or_lost(self):
        self.query.update({"from": "2026-01-15", "to": "2026-01-18"})
        self.assertEqual(self.result()["memorization"]["required"], 10)

    def test_attendance_includes_late_and_excused_as_existing_rule(self):
        for i, status in enumerate(("present", "late", "absent", "excused"), 3):
            self.daily(date(2026, 1, i), attendance=status)
        r = self.result()
        self.assertEqual(r["attendance"]["percentage"], 50)
        self.assertEqual(r["attendance"]["total"], 4)
        self.assertEqual(r["attendance"]["last_attendance"], "2026-01-04")

    def test_exams_use_actual_grading_date_normalized_max_and_no_mutation(self):
        for i, score, maximum in ((1, 18, 20), (2, 40, 50)):
            Evaluation.objects.create(
                student=self.student,
                title=f"اختبار {i}",
                scheduled_date=date(2025, 12, 1),
                evaluated_date=date(2026, 1, i),
                status="passed",
                score=score,
                max_score=maximum,
            )
        scheduled = Evaluation.objects.create(
            student=self.student,
            title="مجدول",
            scheduled_date=date(2026, 1, 1),
            status="scheduled",
            score=100,
        )
        self.daily(date(2026, 1, 5), scattered_test_score=8)
        before = list(Evaluation.objects.values())
        r = self.result()
        self.assertEqual(r["exams"]["average"], 85)
        self.assertEqual(r["exams"]["highest"], 90)
        self.assertEqual(r["exams"]["completed"], 3)
        self.assertEqual(r["exams"]["total"], 4)
        self.assertEqual(before, list(Evaluation.objects.values()))
        self.assertIsNone(
            next(e for e in r["exam_history"] if e["id"] == str(scheduled.id))[
                "percentage"
            ]
        )

    def test_daily_scores_mirrored_to_evaluation_not_double_counted(self):
        e = Evaluation.objects.create(
            student=self.student,
            title="اختبار",
            scheduled_date=date(2026, 1, 1),
            evaluated_date=date(2026, 1, 3),
            status="passed",
            score=80,
        )
        self.daily(date(2026, 1, 3), scattered_test_score=80, evaluation=e)
        self.assertEqual(self.result()["exams"]["total"], 1)

    def test_teacher_summary_matches_all_students_and_pagination(self):
        self.daily(date(2026, 1, 2), from_page=2, to_page=3)
        data = self.client.get(self.base, {**self.query, "page_size": 1}).data["data"]
        self.assertEqual(len(data["students"]), 1)
        self.assertEqual(len(data["comparison"]), 2)
        self.assertEqual(data["summary"]["students"], 2)
        self.assertEqual(
            data["summary"]["memorization"]["completed"],
            self.result()["memorization"]["completed"],
        )
        self.assertEqual(data["summary"]["memorization"]["average_percentage"], 20)
        self.assertEqual(data["summary"]["memorization"]["eligible_students"], 1)

    def test_search_status_and_sort(self):
        d = self.client.get(
            self.base,
            {**self.query, "q": "ثان", "status": "inactive", "sort": "memorization"},
        ).data["data"]
        self.assertEqual(d["summary"]["students"], 1)
        self.assertEqual(d["students"][0]["student"]["id"], str(self.second.id))
        self.assertEqual(d["teacher"]["registered_students"], 2)

    def test_transferred_history_preserves_original_recorder(self):
        row = self.daily(date(2026, 1, 2), from_page=2, to_page=3)
        DailyRecord.objects.filter(pk=row.pk).update(recorded_by=self.other.user)
        self.assertEqual(
            self.result()["memorization_history"][0]["recorder"]["id"],
            str(self.other.user_id),
        )
        Student.objects.filter(pk=self.student.pk).update(teacher=self.other)
        self.assertEqual(self.client.get(self.detail, self.query).status_code, 404)
        self.assertEqual(
            self.client.get(self.base, self.query).data["data"]["summary"]["students"],
            1,
        )

    def test_remaining_assigned_verse_ranges_are_exact(self):
        self.daily(
            date(2026, 1, 2),
            surah_name="البقرة",
            from_ayah=1,
            to_ayah=5,
            next_memorization_target="البقرة",
            next_memorization_from_ayah=1,
            next_memorization_to_ayah=10,
        )
        self.assertEqual(self.result()["targets"][-1]["remaining_ranges"], [(1, 10)])
        p = StudentProgress.objects.create(
            student=self.student,
            teacher=self.teacher,
            surah_number=2,
            surah_name="البقرة",
            juz_number=1,
            from_ayah=1,
            to_ayah=5,
        )
        StudentProgress.objects.filter(pk=p.pk).update(
            recorded_at=timezone.make_aware(timezone.datetime(2026, 1, 3))
        )
        target = self.result()["targets"][-1]
        self.assertEqual(target["remaining_ranges"], [(6, 10)])
        self.assertEqual(target["status"], "unfinished")

    def test_native_verse_targets_drive_dashboard_and_report_without_conversion(self):
        self.plan.delete()
        self.daily(
            date(2026, 1, 3),
            surah_name="البقرة",
            from_ayah=1,
            to_ayah=5,
            required_verses=10,
        )
        r = self.result()
        self.assertEqual(r["memorization_goal"]["unit"], "verses")
        self.assertEqual(r["memorization_goal"]["required"], 10)
        self.assertEqual(r["memorization_goal"]["completed"], 5)
        self.assertEqual(r["memorization_goal"]["remaining"], 5)
        self.assertEqual(r["memorization_goal"]["percentage"], 50)
        self.assertEqual(r["memorization"]["completed"], 0)
        group = self.client.get(self.base, self.query).data["data"]
        self.assertEqual(group["comparison"][0]["memorization"], r["memorization_goal"])
        self.assertEqual(group["summary"]["memorization"]["average_percentage"], 50)
        self.assertEqual(group["trends"][0]["memorization_verses"], 5)
        with patch(
            "reports.services.analytics_pdf.generate_analytics_pdf",
            return_value=b"%PDF",
        ) as render:
            self.client.get(self.detail + "pdf/", self.query)
        self.assertEqual(
            render.call_args.args[0]["students"][0]["memorization_goal"],
            r["memorization_goal"],
        )

    def test_native_verse_period_deduplicates_previously_memorized_content(self):
        self.plan.delete()
        self.daily(date(2025, 12, 20), surah_name="البقرة", from_ayah=1, to_ayah=5)
        self.daily(
            date(2026, 1, 3),
            surah_name="سورة البقرة",
            from_ayah=1,
            to_ayah=10,
            required_verses=10,
        )
        self.daily(date(2026, 1, 4), surah_name="البقرة", from_ayah=1, to_ayah=10)
        r = self.result()
        self.assertEqual(r["cumulative"]["verses"], 10)
        self.assertEqual(r["memorization_goal"]["completed"], 5)
        self.assertEqual(r["memorization_goal"]["percentage"], 50)

    def test_page_and_verse_targets_are_kept_separate(self):
        self.daily(
            date(2026, 1, 3),
            surah_name="البقرة",
            from_ayah=1,
            to_ayah=5,
            required_verses=10,
            memorized_lines=15,
        )
        r = self.result()
        self.assertEqual(r["memorization_goal"]["unit"], "pages")
        self.assertEqual(r["memorization_goal"]["percentage"], 10)
        self.assertEqual(r["verse_memorization"]["percentage"], 50)

    def test_unknown_or_out_of_bounds_verse_ranges_cannot_prove_completion(self):
        self.plan.delete()
        self.daily(
            date(2026, 1, 3),
            surah_name="الفاتحة",
            from_ayah=1,
            to_ayah=100,
            required_verses=100,
        )
        r = self.result()
        self.assertEqual(r["cumulative"]["verses"], 0)
        self.assertIsNone(r["memorization_goal"]["percentage"])

    def test_teacher_remaining_sums_individual_deficits(self):
        WeeklyPlan.objects.filter(pk=self.plan.pk).update(required_pages=5)
        WeeklyPlan.objects.create(
            student=self.second,
            week_start=date(2026, 1, 1),
            month_start=date(2026, 1, 1),
            required_pages=5,
        )
        self.daily(date(2026, 1, 3), from_page=1, to_page=10)
        data = teacher_dataset(self.teacher.id, self.filters)
        self.assertEqual(data["summary"]["memorization"]["completed"], 10)
        self.assertEqual(data["summary"]["memorization"]["remaining"], 5)
        self.assertEqual(data["summary"]["memorization"]["percentage"], 50)

    def test_repeated_verse_content_with_page_metadata_is_not_new_memorization(self):
        self.daily(
            date(2025, 12, 20),
            surah_name="البقرة",
            from_ayah=1,
            to_ayah=10,
            from_page=2,
            to_page=2,
        )
        self.daily(
            date(2026, 1, 3),
            surah_name="البقرة",
            from_ayah=1,
            to_ayah=10,
            from_page=3,
            to_page=3,
        )
        r = self.result()
        self.assertEqual(r["memorization"]["completed"], 0)
        self.assertEqual(r["cumulative"]["pages"], 1)

    def test_persisted_achievement_is_independent_of_attendance(self):
        self.daily(
            date(2026, 1, 3),
            attendance="absent",
            from_page=2,
            to_page=2,
            review_from_page=3,
            review_to_page=3,
        )
        r = self.result()
        self.assertEqual(r["memorization"]["completed"], 1)
        self.assertEqual(r["revision"]["completed"], 1)
        self.assertEqual(r["attendance"]["absent"], 1)

    def test_revision_assignment_requires_recitation_after_assignment(self):
        self.daily(
            date(2026, 1, 3),
            review_surah_name="البقرة",
            review_from_ayah=1,
            review_to_ayah=5,
            next_review_target="البقرة",
            next_review_from_ayah=1,
            next_review_to_ayah=5,
        )
        self.assertEqual(self.result()["targets"][-1]["remaining_ranges"], [(1, 5)])
        p = StudentProgress.objects.create(
            student=self.student,
            teacher=self.teacher,
            type="revision",
            surah_number=2,
            surah_name="البقرة",
            juz_number=1,
            from_ayah=1,
            to_ayah=3,
        )
        StudentProgress.objects.filter(pk=p.pk).update(
            recorded_at=timezone.make_aware(timezone.datetime(2026, 1, 4))
        )
        self.assertEqual(self.result()["targets"][-1]["remaining_ranges"], [(4, 5)])

    def test_friday_is_preserved_in_history_but_excluded_from_attendance_rate(self):
        self.daily(date(2026, 1, 2), attendance="absent")
        self.daily(date(2026, 1, 3), attendance="present")
        r = self.result()
        self.assertEqual(r["attendance"]["percentage"], 100)
        self.assertEqual(r["attendance"]["total"], 1)
        self.assertEqual(len(r["attendance_history"]), 2)
        self.assertFalse(r["attendance_history"][0]["counted"])

    def test_linked_exam_does_not_hide_an_unmatched_other_daily_exam(self):
        e = Evaluation.objects.create(
            student=self.student,
            title="متفرقة",
            scheduled_date=date(2026, 1, 1),
            evaluated_date=date(2026, 1, 3),
            evaluation_type="scattered",
            status="passed",
            score=80,
        )
        self.daily(
            date(2026, 1, 3),
            scattered_test_score=80,
            combined_test_score=9,
            evaluation=e,
        )
        r = self.result()
        self.assertEqual(r["exams"]["total"], 2)
        self.assertEqual(r["exams"]["average"], 80)

    def test_last_grade_is_actual_latest_mark_without_assumed_maximum(self):
        Evaluation.objects.create(
            student=self.student,
            title="اختبار",
            scheduled_date=date(2026, 1, 1),
            evaluated_date=date(2026, 1, 3),
            status="passed",
            score=18,
            max_score=20,
        )
        self.daily(date(2026, 1, 4), combined_test_score=9)
        r = self.result()
        self.assertEqual(r["exams"]["last"], 9)
        self.assertIsNone(r["exams"]["last_max_score"])
        self.assertEqual(r["exams"]["average"], 90)

    def test_recent_update_of_old_exam_appears_in_timeline_and_last_activity(self):
        e = Evaluation.objects.create(
            student=self.student,
            title="اختبار سابق",
            scheduled_date=date(2025, 12, 1),
            evaluated_date=date(2025, 12, 3),
            status="passed",
            score=90,
        )
        Evaluation.objects.filter(id=e.id).update(
            updated_at=timezone.make_aware(timezone.datetime(2026, 1, 20))
        )
        r = self.result()
        self.assertEqual(r["exam_history"], [])
        self.assertEqual(r["timeline"][0]["type"], "evaluation_update")
        self.assertEqual(r["student"]["last_activity"], "2026-01-20")

    def test_validation_permissions_and_cross_teacher_student(self):
        for url in (self.base, self.detail, self.base + "pdf/", self.detail + "pdf/"):
            self.client.force_authenticate(None)
            self.assertEqual(self.client.get(url).status_code, 401)
            for user in (self.teacher_user, self.student.user):
                self.client.force_authenticate(user)
                self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.get(
                self.base, {"period": "custom", "from": "invalid"}
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.get(
                self.base, {**self.query, "from": "2026-02-01"}
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.get(self.base, {"page_size": 101}).status_code, 400
        )
        self.assertEqual(
            self.client.get(
                self.detail.replace(str(self.teacher.id), str(self.other.id)),
                self.query,
            ).status_code,
            404,
        )

    def test_constant_query_count_large_roster_and_no_writes(self):
        users = User.objects.bulk_create(
            [User(national_id=f"bulk-{i}", role="student") for i in range(150)]
        )
        Student.objects.bulk_create(
            [
                Student(
                    user=u,
                    teacher=self.teacher,
                    full_name=f"طالب {i}",
                    birthdate=date(2012, 1, 1),
                    grade="5",
                )
                for i, u in enumerate(users)
            ]
        )
        students = list(Student.objects.filter(user__in=users))
        DailyRecord.objects.bulk_create(
            [
                DailyRecord(
                    student=s,
                    recorded_by=self.teacher_user,
                    date=date(2026, 1, 2),
                    day="sat",
                    from_page=2,
                    to_page=2,
                )
                for s in students
            ]
        )
        with self.assertNumQueries(9):
            data = teacher_dataset(self.teacher.id, self.filters)
        self.assertEqual(len(data["students"]), 152)

    def test_pdf_dataset_matches_filters_and_contains_every_student(self):
        with patch(
            "reports.services.analytics_pdf.generate_analytics_pdf",
            return_value=b"%PDF-verified",
        ) as generate:
            response = self.client.get(
                self.base + "pdf/", {**self.query, "page_size": 1}
            )
        payload = generate.call_args.args[0]
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(payload["students"]), 2)
        self.assertEqual(
            payload["summary"],
            self.client.get(self.base, self.query).data["data"]["summary"],
        )
        self.assertEqual(
            payload["period"],
            self.client.get(self.base, self.query).data["data"]["period"],
        )

    def test_actual_pdf_paginates_full_history_embeds_arabic_and_prints(self):
        DailyRecord.objects.bulk_create(
            [
                DailyRecord(
                    student=self.student,
                    day="sat",
                    date=date(2026, 1, 1) + timedelta(days=i),
                    from_page=2 + i,
                    to_page=2 + i,
                    surah_name="البقرة",
                    note="ملاحظة عربية طويلة " * 50,
                )
                for i in range(70)
            ]
        )
        response = self.client.get(self.base + "pdf/", {"print": "1"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF-"))
        self.assertIn(b"/FontFile2", response.content)
        self.assertGreater(len(re.findall(rb"/Type /Page\b", response.content)), 4)
        self.assertIn("inline", response["Content-Disposition"])
        self.assertEqual(response["Cache-Control"], "private, no-store")


class CoverageTests(TestCase):
    def test_union_and_exact_remaining_of_large_overlapping_ranges(self):
        coverage = Coverage()
        self.assertEqual(coverage.add("s", 1, 1000000), 1000000)
        self.assertEqual(coverage.add("s", 500000, 1000001), 1)
        self.assertEqual(coverage.remaining("s", 999999, 1000005), [(1000002, 1000005)])
