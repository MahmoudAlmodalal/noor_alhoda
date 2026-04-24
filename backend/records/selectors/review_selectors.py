from datetime import date as date_cls, timedelta

from django.db.models import Min, Max

from records.models import DailyRecord, ReviewRecord, SurahMastery
from students.models import Student


REVIEW_POOL_LIMIT = 3


def review_pool_for_student(*, student: Student, as_of: date_cls) -> list[dict]:
    """
    Adaptive review pool for a student on a given date.

    Sources:
      - SurahMastery rows (authoritative schedule), for surahs the student
        has already been reviewed at least once under the new algorithm.
      - Bootstrap seed: surahs the student has memorized with quality
        >= acceptable but no mastery row yet. These are scheduled using
        student.review_interval_days from the last memorization/review date.

    Returns rows where next_due_date <= as_of, ranked by most overdue first
    then hardest (lowest ease_factor). Limited to REVIEW_POOL_LIMIT.

    Each returned dict preserves the legacy shape (surah_name, first_memorized,
    last_memorized, last_review_date, days_since_review) for backward-compat
    with consumers, and adds next_due_date, overdue_days, ease_factor,
    interval_days, streak for the adaptive UI.
    """
    interval_base = student.review_interval_days or 14

    memorized_qs = (
        DailyRecord.objects.filter(
            weekly_plan__student=student,
            quality__in=[
                DailyRecord.Quality.EXCELLENT,
                DailyRecord.Quality.GOOD,
                DailyRecord.Quality.ACCEPTABLE,
            ],
        )
        .exclude(surah_name="")
        .values("surah_name")
        .annotate(
            first_memorized=Min("date"),
            last_memorized=Max("date"),
        )
    )
    memorized_by_name: dict[str, dict] = {
        row["surah_name"]: row for row in memorized_qs
    }
    if not memorized_by_name:
        return []

    names = list(memorized_by_name.keys())

    masteries_by_name: dict[str, SurahMastery] = {
        m.surah_name: m
        for m in SurahMastery.objects.filter(student=student, surah_name__in=names)
    }

    last_reviews_by_name: dict[str, ReviewRecord] = {}
    for rr in (
        ReviewRecord.objects.filter(student=student, surah_name__in=names)
        .order_by("-reviewed_date")
    ):
        if rr.surah_name not in last_reviews_by_name:
            last_reviews_by_name[rr.surah_name] = rr

    candidates: list[dict] = []
    for surah_name, mem_row in memorized_by_name.items():
        mastery = masteries_by_name.get(surah_name)
        last_review = last_reviews_by_name.get(surah_name)

        if mastery is not None:
            next_due = mastery.next_due_date
            ease_factor = float(mastery.ease_factor)
            interval_days = int(mastery.interval_days or interval_base)
            streak = int(mastery.streak or 0)
        else:
            # Bootstrap: seed the first due date from the last known activity.
            base = (
                last_review.reviewed_date
                if last_review is not None
                else mem_row["first_memorized"]
            )
            next_due = base + timedelta(days=interval_base)
            ease_factor = 2.5
            interval_days = interval_base
            streak = 0

        if next_due > as_of:
            continue

        overdue_days = max(0, (as_of - next_due).days)
        last_review_date = (
            last_review.reviewed_date if last_review is not None else None
        )
        days_since_review = (
            (as_of - last_review_date).days
            if last_review_date is not None
            else (as_of - mem_row["first_memorized"]).days
        )

        candidates.append(
            {
                "surah_name": surah_name,
                "first_memorized": mem_row["first_memorized"],
                "last_memorized": mem_row["last_memorized"],
                "last_review_date": last_review_date,
                "days_since_review": days_since_review,
                "next_due_date": next_due,
                "overdue_days": overdue_days,
                "ease_factor": round(ease_factor, 2),
                "interval_days": interval_days,
                "streak": streak,
            }
        )

    # Most overdue first, then hardest (lowest ease).
    candidates.sort(key=lambda c: (-c["overdue_days"], c["ease_factor"]))

    return candidates[:REVIEW_POOL_LIMIT]
