from datetime import date as date_cls, timedelta

from django.db.models import Min, Max

from records.models import DailyRecord, ReviewRecord
from students.models import Student


REVIEW_POOL_LIMIT = 3


def review_pool_for_student(*, student: Student, as_of: date_cls) -> list[dict]:
    """
    Auto-rotated review candidates for a student on a given date.

    Pool = distinct surah_names the student has memorized with quality in
    {excellent, good, acceptable}, excluding any surah reviewed in the last
    student.review_interval_days. Ordered by earliest memorization date asc,
    limited to REVIEW_POOL_LIMIT.
    """
    interval = student.review_interval_days or 14
    cutoff = as_of - timedelta(days=interval)

    # Surahs memorized with acceptable+ quality.
    memorized_qs = (
        DailyRecord.objects
        .filter(
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

    # Surahs with a recent review are excluded.
    recently_reviewed = set(
        ReviewRecord.objects
        .filter(student=student, reviewed_date__gt=cutoff)
        .values_list("surah_name", flat=True)
    )

    candidates = []
    for row in memorized_qs:
        if row["surah_name"] in recently_reviewed:
            continue

        # Freshly-memorized surahs are not due for review yet.
        if row["last_memorized"] > cutoff:
            continue

        last_review = (
            ReviewRecord.objects
            .filter(student=student, surah_name=row["surah_name"])
            .order_by("-reviewed_date")
            .first()
        )
        last_review_date = last_review.reviewed_date if last_review else None
        days_since_review = (
            (as_of - last_review_date).days
            if last_review_date
            else (as_of - row["first_memorized"]).days
        )

        candidates.append({
            "surah_name": row["surah_name"],
            "first_memorized": row["first_memorized"],
            "last_memorized": row["last_memorized"],
            "last_review_date": last_review_date,
            "days_since_review": days_since_review,
        })

    # Oldest-memorized first.
    candidates.sort(key=lambda c: c["first_memorized"])
    return candidates[:REVIEW_POOL_LIMIT]
