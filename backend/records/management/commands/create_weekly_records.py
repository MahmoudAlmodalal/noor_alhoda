from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from backend.records.models import WeeklyPlan, DailyRecord
from backend.students.models import Student


class Command(BaseCommand):
    help = "FR-14: Auto-create weekly plans and daily records for all active students."

    def handle(self, *args, **options):
        today = timezone.now().date()
        # Calculate the Saturday of the current week
        days_since_saturday = (today.weekday() + 2) % 7
        week_start = today - timedelta(days=days_since_saturday)

        students = Student.objects.filter(is_active=True)
        day_offsets = [
            (0, "sat"), (1, "sun"), (2, "mon"),
            (3, "tue"), (4, "wed"), (5, "thu"),
        ]

        created_count = 0
        for student in students:
            plan, _ = WeeklyPlan.objects.get_or_create(
                student=student,
                week_start=week_start,
                defaults={"week_number": 1},
            )
            for offset, day_code in day_offsets:
                record_date = week_start + timedelta(days=offset)
                _, created = DailyRecord.objects.get_or_create(
                    weekly_plan=plan,
                    day=day_code,
                    defaults={
                        "date": record_date,
                        "attendance": "present",
                        "result": "pending",
                    },
                )
                if created:
                    created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"تم إنشاء {created_count} سجل يومي لـ {students.count()} طالب."
            )
        )
