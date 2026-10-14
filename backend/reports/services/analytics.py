"""Read-only analytics over persisted records; no cached plan totals or Quran guesses.

The roster is current. Historical activity keeps its original recorder; it is not
attributed to the current teacher. Page equivalents use the application's explicit
15-lines/page convention, never a verse/Juz-to-page conversion. Unidentifiable
portions are activity, not proven new memorization.
"""

from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
import re

from django.shortcuts import get_object_or_404
from django.utils import timezone
from evaluations.models import Evaluation
from progress.constants import SURAH_BY_NUMBER
from progress.models import StudentProgress
from records.models import DailyRecord, ReviewRecord, WeeklyPlan
from students.models import Student
from teacher.models import Teacher

LINES_PER_PAGE = 15  # WeeklyPlan.total_pages / existing page_progress contract
METHODS = [
    "إحصاءات المجموعة للطلاب المنتسبين حاليًا، وتشمل تاريخهم السابق. لا تُنسب السجلات السابقة للمحفّظ الحالي؛ يظهر المسجّل الأصلي في التفاصيل.",
    "الحفظ الجديد يحسب باتحاد النطاقات الموثقة منذ أول سجل حتى نهاية الفترة. التكرار لا يضيف حفظًا جديدًا. الآيات والأجزاء لا تُحوّل إلى صفحات.",
    "السجلات بلا نطاق محدد، أو ذات نطاق جزئي لا يمكن تحديد تداخله، تظهر كنشاط غير قابل للتحقق؛ نسبة الخطة والمتبقي غير محسومين عند وجودها.",
    "الخطط المتقاطعة مع الفترة تُحتسب كاملة دون توزيع يومي مفترض. لا يُعد غياب الخطة إنجازًا مكتملًا.",
    "الحضور من الأيام المسجلة فقط: الحاضر والمتأخر ضمن الحضور، والمستأذن ضمن المقام وفق قواعد التقرير الحالي. الجمعة والحالات غير الصالحة لا تدخل في النسبة. الأيام غير المسجلة لا تُعامل كغياب.",
    "أهداف الآيات في السجلات اليومية مستقلة عن خطط الصفحات ولا تُجمع معها. نسبة خطة الطالب تستخدم أهداف الصفحات إن وجدت، وإلا أهداف الآيات المسجلة. متوسط إنجاز المجموعة هو متوسط نسب الطلاب ذوي الأهداف القابلة للحساب. متوسط الاختبارات متوسط الدرجات المقيّمة بعد توحيدها إلى نسبة مئوية.",
]


def number(value):
    return round(float(value), 2)


def average(values):
    values = [v for v in values if v is not None]
    return number(sum(values) / len(values)) if values else None


def surah_key(name):
    return (
        re.sub(r"[\s\u064b-\u065f]", "", str(name).removeprefix("سورة").strip())
        .replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
    )


SURAH_VERSE_LIMITS = {
    surah_key(s["name_ar"]): s["verses"] for s in SURAH_BY_NUMBER.values()
}


def valid_range(start, end):
    return bool(start and end and start > 0 and end >= start)


def valid_verse_range(name, start, end):
    limit = SURAH_VERSE_LIMITS.get(surah_key(name))
    return bool(limit and valid_range(start, end) and end <= limit)


class Coverage:
    """Interval unions, avoiding expansion into potentially huge page/verse sets."""

    def __init__(self):
        self.ranges = defaultdict(list)

    def add(self, key, start, end):
        if not valid_range(start, end):
            return 0
        previous = self.ranges[key]
        overlap = sum(max(0, min(end, b) - max(start, a) + 1) for a, b in previous)
        merged = []
        for a, b in sorted(previous + [(start, end)]):
            if merged and a <= merged[-1][1] + 1:
                merged[-1] = (merged[-1][0], max(b, merged[-1][1]))
            else:
                merged.append((a, b))
        self.ranges[key] = merged
        return end - start + 1 - overlap

    def remaining(self, key, start, end):
        parts = [(start, end)]
        for a, b in self.ranges[key]:
            next_parts = []
            for x, y in parts:
                if b < x or a > y:
                    next_parts.append((x, y))
                else:
                    if x < a:
                        next_parts.append((x, a - 1))
                    if b < y:
                        next_parts.append((b + 1, y))
            parts = next_parts
        return parts


def within(day, filters):
    return (not filters.get("from") or day >= filters["from"]) and day <= filters["to"]


def plan_bounds(plan):
    first = plan.month_start or plan.week_start
    last = (
        first.replace(day=monthrange(first.year, first.month)[1])
        if plan.month_start
        else first + timedelta(days=5)
    )
    return first, last


def recorder(user):
    return (
        {
            "id": str(user.id),
            "name": user.get_full_name() or user.national_id,
            "role": user.role,
        }
        if user
        else None
    )


def daily_entry(row, revision=False):
    prefix = "review_" if revision else ""
    return {
        "id": str(row.id) + (":revision" if revision else ":memorization"),
        "record_id": str(row.id),
        "source": "daily_record",
        "date": str(row.date),
        "surah": getattr(row, prefix + "surah_name"),
        "juz": None,
        "from_ayah": getattr(row, prefix + "from_ayah"),
        "to_ayah": getattr(row, prefix + "to_ayah"),
        "from_page": getattr(row, prefix + "from_page"),
        "to_page": getattr(row, prefix + "to_page"),
        "lines": row.review_lines if revision else row.memorized_lines,
        "verses": (
            (getattr(row, prefix + "to_ayah") - getattr(row, prefix + "from_ayah") + 1)
            if valid_range(
                getattr(row, prefix + "from_ayah"), getattr(row, prefix + "to_ayah")
            )
            else (None if revision else row.achieved_verses)
        ),
        "quality": row.review_quality if revision else row.quality,
        "note": row.note,
        "result": row.result,
        "recorder": recorder(row.recorded_by),
        "pages": None,
        "new_pages": 0,
        "new_verses": 0,
    }


def progress_entry(row):
    return {
        "id": str(row.id),
        "source": "progress",
        "date": str(timezone.localdate(row.recorded_at)),
        "surah": row.surah_name,
        "juz": row.juz_number,
        "from_ayah": row.from_ayah,
        "to_ayah": row.to_ayah,
        "from_page": None,
        "to_page": None,
        "lines": 0,
        "verses": (
            row.to_ayah - row.from_ayah + 1
            if valid_range(row.from_ayah, row.to_ayah)
            else None
        ),
        "pages": None,
        "quality": None,
        "note": row.note,
        "result": None,
        "recorder": (
            {
                "id": str(row.teacher.user_id),
                "name": row.teacher.full_name,
                "role": "teacher",
            }
            if row.teacher
            else None
        ),
        "new_pages": 0,
        "new_verses": 0,
    }


def memorization_entries(daily, progress, end):
    entries = [
        daily_entry(r)
        for r in daily
        if r.date <= end
        and (
            r.memorized_lines
            or r.achieved_verses
            or valid_range(r.from_page, r.to_page)
            or (r.surah_name and valid_range(r.from_ayah, r.to_ayah))
            or (r.surah_name and r.quality != "none")
        )
    ]
    entries += [
        progress_entry(r)
        for r in progress
        if r.type == "memorization" and timezone.localdate(r.recorded_at) <= end
    ]
    entries.sort(key=lambda e: (e["date"], e["source"] != "daily_record", e["id"]))
    pages, touched_pages, verses, measured_verses = (
        Coverage(),
        Coverage(),
        Coverage(),
        Coverage(),
    )
    # If a surah mixes line/verse units and page-only records, no cross-unit
    # deduplication is possible. Keep those line amounts unquantified.
    page_only_surahs = {
        surah_key(e["surah"])
        for e in entries
        if valid_range(e["from_page"], e["to_page"])
    }
    for e in entries:
        key = surah_key(e["surah"])
        verse_range = valid_verse_range(e["surah"], e["from_ayah"], e["to_ayah"])
        new_verses = verses.add(key, e["from_ayah"], e["to_ayah"]) if verse_range else 0
        e["new_verses"] = new_verses
        page_range = valid_range(e["from_page"], e["to_page"])
        e["quantified"] = False
        e["verified_pages"] = 0
        if e["lines"]:
            e["pages"] = e["lines"] / LINES_PER_PAGE
        if page_range:
            count = e["to_page"] - e["from_page"] + 1
            untouched = touched_pages.add("quran", e["from_page"], e["to_page"])
            e["pages"] = e["lines"] / LINES_PER_PAGE if e["lines"] else count
            # Partial page line positions are absent; never infer which lines
            # were new. Full explicit page ranges can be unioned exactly.
            if not e["lines"] or e["lines"] == count * LINES_PER_PAGE:
                verified = pages.add("quran", e["from_page"], e["to_page"])
                e["verified_pages"] = verified
                e["new_pages"] = untouched
                e["quantified"] = verified == untouched
                if verse_range:
                    verse_count = e["to_ayah"] - e["from_ayah"] + 1
                    unmeasured = measured_verses.add(key, e["from_ayah"], e["to_ayah"])
                    if new_verses == 0:
                        e["new_pages"] = 0
                        e["verified_pages"] = (
                            verified if unmeasured == verse_count else 0
                        )
                        e["quantified"] = unmeasured in (0, verse_count)
                    elif new_verses != verse_count:
                        e["new_pages"] = 0
                        e["verified_pages"] = 0
                        e["quantified"] = False
        elif e["lines"] and verse_range and key not in page_only_surahs:
            e["pages"] = e["lines"] / LINES_PER_PAGE
            count = e["to_ayah"] - e["from_ayah"] + 1
            if new_verses == count:
                e["new_pages"] = e["lines"] / LINES_PER_PAGE
                e["verified_pages"] = e["new_pages"]
                e["quantified"] = True
                measured_verses.add(key, e["from_ayah"], e["to_ayah"])
            elif new_verses == 0:
                e["quantified"] = True
        elif verse_range and new_verses == 0:
            e["quantified"] = True
    return entries, verses


def category(required, completed, uncertain=0):
    return {
        "_required_exact": float(required),
        "_completed_exact": float(completed),
        "required": number(required),
        "completed": number(completed),
        "remaining": (
            number(max(0, required - completed))
            if required > 0 and not uncertain
            else None
        ),
        "percentage": (
            number(min(100, completed / required * 100))
            if required > 0 and not uncertain
            else None
        ),
        "unquantified_sessions": uncertain,
        "has_target": required > 0,
    }


def load_records(students):
    """Five batched queries regardless of roster size; relationships are joined."""
    ids = [s.id for s in students]
    grouped = {
        str(s.id): {
            "daily": [],
            "plans": [],
            "progress": [],
            "reviews": [],
            "exams": [],
        }
        for s in students
    }
    sources = [
        (
            "daily",
            DailyRecord.objects.filter(student_id__in=ids)
            .select_related("recorded_by")
            .order_by("date", "id"),
        ),
        ("plans", WeeklyPlan.objects.filter(student_id__in=ids)),
        (
            "progress",
            StudentProgress.objects.filter(student_id__in=ids).select_related(
                "teacher"
            ),
        ),
        (
            "reviews",
            ReviewRecord.objects.filter(student_id__in=ids).select_related(
                "recorded_by"
            ),
        ),
        (
            "exams",
            Evaluation.objects.filter(student_id__in=ids).select_related("created_by"),
        ),
    ]
    for name, query in sources:
        for row in query.iterator(chunk_size=2000):
            grouped[str(row.student_id)][name].append(row)
    return grouped


def valid_attendance(record):
    return (
        record.date.weekday() != 4
        and record.attendance in DailyRecord.Attendance.values
    )


def student_analytics(student, teacher, records, filters, detailed=True):
    daily = [r for r in records["daily"] if within(r.date, filters)]
    plans = [
        p
        for p in records["plans"]
        if plan_bounds(p)[0] <= filters["to"]
        and (not filters.get("from") or plan_bounds(p)[1] >= filters["from"])
    ]
    all_mem, coverage = memorization_entries(
        records["daily"], records["progress"], filters["to"]
    )
    mem = [e for e in all_mem if within(date.fromisoformat(e["date"]), filters)]
    revision = [
        daily_entry(r, True)
        for r in daily
        if (
            r.review_lines
            or valid_range(r.review_from_page, r.review_to_page)
            or (
                r.review_surah_name
                and (
                    r.review_quality != "none"
                    or valid_range(r.review_from_ayah, r.review_to_ayah)
                )
            )
        )
    ]
    for e in revision:
        e["pages"] = (
            e["lines"] / LINES_PER_PAGE
            if e["lines"]
            else (
                e["to_page"] - e["from_page"] + 1
                if valid_range(e["from_page"], e["to_page"])
                else None
            )
        )
    for r in records["reviews"]:
        if within(r.reviewed_date, filters):
            revision.append(
                {
                    "id": str(r.id),
                    "source": "review_record",
                    "date": str(r.reviewed_date),
                    "surah": r.surah_name,
                    "juz": None,
                    "pages": None,
                    "lines": 0,
                    "from_ayah": None,
                    "to_ayah": None,
                    "from_page": None,
                    "to_page": None,
                    "quality": r.quality,
                    "result": None,
                    "note": r.note,
                    "recorder": recorder(r.recorded_by),
                }
            )
    revision += [
        progress_entry(r)
        for r in records["progress"]
        if r.type == "revision" and within(timezone.localdate(r.recorded_at), filters)
    ]
    revision.sort(key=lambda e: (e["date"], e["id"]))
    # Mirror rows from independent review/progress APIs stay in the history,
    # but a matching daily session contributes one activity, not two workloads.
    revision_sessions = {(e["date"], surah_key(e["surah"])) for e in revision}
    quantified_revision = {
        (e["date"], surah_key(e["surah"])) for e in revision if e["pages"] is not None
    }
    unknown_revision = len(revision_sessions - quantified_revision)
    memorization = category(
        sum(
            float(p.required_pages or 0) or p.total_required_lines / LINES_PER_PAGE
            for p in plans
        ),
        sum(e["new_pages"] for e in mem),
        sum(not e["quantified"] for e in mem),
    )
    review = category(
        sum(float(p.review_required_pages or 0) for p in plans),
        sum(e["pages"] or 0 for e in revision),
        unknown_revision,
    )
    verse_memorization = category(
        sum(r.required_verses for r in daily),
        sum(e["new_verses"] for e in mem),
        sum(
            not valid_verse_range(e["surah"], e["from_ayah"], e["to_ayah"]) for e in mem
        ),
    )
    goal = (
        memorization
        if memorization["has_target"] or not verse_memorization["has_target"]
        else verse_memorization
    )
    goal_unit = "pages" if goal is memorization else "verses"
    attendance_records = [r for r in daily if valid_attendance(r)]
    attendance = {
        "present": sum(r.attendance == "present" for r in attendance_records),
        "late": sum(r.attendance == "late" for r in attendance_records),
        "absent": sum(r.attendance == "absent" for r in attendance_records),
        "excused": sum(r.attendance == "excused" for r in attendance_records),
        "total": len(attendance_records),
    }
    attendance["percentage"] = (
        number(
            (attendance["present"] + attendance["late"]) / len(attendance_records) * 100
        )
        if attendance_records
        else None
    )
    attendance["last_attendance"] = (
        str(
            max(
                (
                    r.date
                    for r in attendance_records
                    if r.attendance in ("present", "late")
                ),
                default="",
            )
        )
        or None
    )
    exams = []
    for r in records["exams"]:
        day = r.evaluated_date or r.scheduled_date
        if within(day, filters):
            score = number(r.score) if r.score is not None else None
            percentage = (
                number(r.score / r.max_score * 100)
                if r.status in ("passed", "failed")
                and r.score is not None
                and r.max_score > 0
                else None
            )
            exams.append(
                {
                    "id": str(r.id),
                    "source": "evaluation",
                    "title": r.title,
                    "surah": r.surah_range,
                    "date": str(day),
                    "scheduled_date": str(r.scheduled_date),
                    "evaluated_date": (
                        str(r.evaluated_date) if r.evaluated_date else None
                    ),
                    "status": r.status,
                    "score": score,
                    "max_score": number(r.max_score),
                    "percentage": percentage,
                    "note": r.result_note,
                    "recorder": recorder(r.created_by),
                    "updated_at": r.updated_at.isoformat(),
                    "updated_date": str(timezone.localdate(r.updated_at)),
                }
            )
    # Raw daily test marks have no stored maximum. Show them separately rather
    # than assuming /100 or counting them again when linked to an evaluation.
    exam_mirrors = {
        (e.evaluated_date, e.evaluation_type, e.score) for e in records["exams"]
    }
    linked_exam_types = {e.id: e.evaluation_type for e in records["exams"]}
    for r in daily:
        for kind in ("scattered", "combined"):
            score = getattr(r, kind + "_test_score")
            if (
                score is not None
                and (r.date, kind, score) not in exam_mirrors
                and linked_exam_types.get(r.evaluation_id) != kind
            ):
                exams.append(
                    {
                        "id": str(r.id) + ":" + kind,
                        "source": "daily_record",
                        "title": (
                            "اختبار متفرقة" if kind == "scattered" else "اختبار مجتمعة"
                        ),
                        "surah": r.surah_name,
                        "date": str(r.date),
                        "scheduled_date": None,
                        "evaluated_date": str(r.date),
                        "status": "recorded",
                        "score": score,
                        "max_score": None,
                        "percentage": None,
                        "note": r.note,
                        "recorder": recorder(r.recorded_by),
                        "updated_at": r.updated_at.isoformat(),
                        "updated_date": str(timezone.localdate(r.updated_at)),
                    }
                )
    exams.sort(key=lambda e: (e["date"], e["id"]))
    graded = [e for e in exams if e["percentage"] is not None]
    assessed = [
        e
        for e in exams
        if e["status"] in ("passed", "failed", "recorded") and e["score"] is not None
    ]
    activity_dates = [e["date"] for e in mem + revision + exams] + [
        str(r.date) for r in daily
    ]
    activity_dates += [
        str(timezone.localdate(e.updated_at))
        for e in records["exams"]
        if e.status != "scheduled" and within(timezone.localdate(e.updated_at), filters)
    ]
    result = {
        "student": {
            "id": str(student.id),
            "name": student.full_name,
            "active": student.user.is_active,
            "teacher_name": teacher.full_name,
            "ring": teacher.ring_name,
            "enrollment_date": str(student.enrollment_date),
            "reported_memorized_verses": student.memorized_verses,
            "current_surah": student.current_surah,
            "current_juz": student.current_juz,
            "current_page": student.current_page,
            "last_activity": max(activity_dates, default=None),
        },
        "memorization": memorization,
        "verse_memorization": verse_memorization,
        "memorization_goal": {**goal, "unit": goal_unit},
        "revision": review,
        "cumulative": {
            "pages": number(sum(e["verified_pages"] for e in all_mem)),
            "verses": sum(e["new_verses"] for e in all_mem),
            "unquantified_sessions": sum(not e["quantified"] for e in all_mem),
            "as_of": str(filters["to"]),
        },
        "attendance": attendance,
        "exams": {
            "total": len(exams),
            "completed": sum(
                e["status"] in ("passed", "failed", "recorded") for e in exams
            ),
            "average": average(e["percentage"] for e in graded),
            "highest": max((e["percentage"] for e in graded), default=None),
            "last": assessed[-1]["score"] if assessed else None,
            "last_max_score": assessed[-1]["max_score"] if assessed else None,
            "graded_count": len(graded),
            "score_sum": sum(e["percentage"] for e in graded),
        },
        "sessions": {
            "memorization": len({e["date"] for e in mem}),
            "revision": len(revision_sessions),
            "recitation": len({e["date"] for e in mem + revision}),
            "last_memorization": mem[-1]["date"] if mem else None,
            "last_revision": revision[-1]["date"] if revision else None,
        },
        "trends": build_trends(
            mem, revision, attendance_records, exams, filters.get("group_by", "month")
        ),
        "weekly_trends": build_trends(mem, revision, attendance_records, exams, "week"),
        "monthly_trends": build_trends(
            mem, revision, attendance_records, exams, "month"
        ),
    }
    if detailed:
        targets = []
        for p in plans:
            first, last = plan_bounds(p)
            targets.append(
                {
                    "id": str(p.id),
                    "source": "plan",
                    "date": str(first),
                    "end": str(last),
                    "memorization_pages": number(
                        p.required_pages or p.total_required_lines / LINES_PER_PAGE
                    ),
                    "revision_pages": number(p.review_required_pages),
                    "verses": p.total_required,
                    "portions": None,
                }
            )
        # Latest persisted next target before the report cutoff is the only
        # authoritative pending target. Free text cannot be marked completed.
        prior_daily = [r for r in records["daily"] if r.date <= filters["to"]]
        if prior_daily:
            last = prior_daily[-1]
            for kind, prefix in (
                ("memorization", "next_memorization"),
                ("revision", "next_review"),
            ):
                text = getattr(last, prefix + "_target")
                a, b = getattr(last, prefix + "_from_ayah"), getattr(
                    last, prefix + "_to_ayah"
                )
                if text and within(last.date, filters):
                    # Only exact recognized Surah names have verifiable ranges.
                    key = surah_key(text)
                    known = key in {
                        surah_key(s["name_ar"]) for s in SURAH_BY_NUMBER.values()
                    }
                    remaining = None
                    if (
                        kind == "memorization"
                        and known
                        and valid_verse_range(text, a, b)
                    ):
                        assigned_coverage = Coverage()
                        for e in all_mem:
                            if (
                                last.date
                                < date.fromisoformat(e["date"])
                                <= filters["to"]
                                and surah_key(e["surah"]) == key
                                and valid_verse_range(
                                    e["surah"], e["from_ayah"], e["to_ayah"]
                                )
                            ):
                                assigned_coverage.add(key, e["from_ayah"], e["to_ayah"])
                        remaining = assigned_coverage.remaining(key, a, b)
                    if kind == "revision" and known and valid_verse_range(text, a, b):
                        review_coverage = Coverage()
                        for r in records["daily"]:
                            if (
                                last.date < r.date <= filters["to"]
                                and surah_key(r.review_surah_name) == key
                                and valid_verse_range(
                                    r.review_surah_name,
                                    r.review_from_ayah,
                                    r.review_to_ayah,
                                )
                            ):
                                review_coverage.add(
                                    key, r.review_from_ayah, r.review_to_ayah
                                )
                        for r in records["progress"]:
                            if (
                                r.type == "revision"
                                and last.date
                                < timezone.localdate(r.recorded_at)
                                <= filters["to"]
                                and surah_key(r.surah_name) == key
                                and valid_verse_range(
                                    r.surah_name, r.from_ayah, r.to_ayah
                                )
                            ):
                                review_coverage.add(key, r.from_ayah, r.to_ayah)
                        remaining = review_coverage.remaining(key, a, b)
                    targets.append(
                        {
                            "id": str(last.id) + ":" + kind,
                            "source": "next_target",
                            "date": str(last.date),
                            "kind": kind,
                            "text": text,
                            "from_ayah": a,
                            "to_ayah": b,
                            "remaining_ranges": remaining,
                            "status": (
                                "completed"
                                if remaining == []
                                else "unfinished" if remaining else "unverified"
                            ),
                        }
                    )
        timeline = [
            {
                "id": e["id"],
                "date": e["date"],
                "type": "memorization",
                "details": e["surah"],
                "result": e["quality"] or e["result"],
                "note": e["note"],
            }
            for e in mem
        ]
        timeline += [
            {
                "id": e["id"],
                "date": e["date"],
                "type": "revision",
                "details": e["surah"],
                "result": e["quality"],
                "note": e["note"],
            }
            for e in revision
        ]
        timeline += [
            {
                "id": str(r.id) + ":attendance",
                "date": str(r.date),
                "type": "attendance",
                "details": "الحضور",
                "result": r.attendance,
                "note": "",
            }
            for r in daily
        ]
        timeline += [
            {
                "id": e["id"],
                "date": e["date"],
                "type": "exam",
                "details": e["title"],
                "result": e["status"],
                "note": e["note"],
            }
            for e in exams
        ]
        timeline += [
            {
                "id": str(e.id) + ":update",
                "date": str(timezone.localdate(e.updated_at)),
                "type": "evaluation_update",
                "details": e.title,
                "result": e.status,
                "note": e.result_note,
            }
            for e in records["exams"]
            if e.status != "scheduled"
            and within(timezone.localdate(e.updated_at), filters)
        ]
        result.update(
            {
                "memorization_history": mem,
                "revision_history": revision,
                "exam_history": exams,
                "targets": targets,
                "attendance_history": [
                    {
                        "id": str(r.id),
                        "date": str(r.date),
                        "status": r.attendance,
                        "counted": valid_attendance(r),
                        "recorder": recorder(r.recorded_by),
                    }
                    for r in daily
                ],
                "timeline": sorted(
                    timeline, key=lambda e: (e["date"], e["id"]), reverse=True
                ),
            }
        )
    return result


def build_trends(mem, revision, daily, exams, group_by):
    groups = defaultdict(
        lambda: {
            "memorization": None,
            "memorization_verses": None,
            "revision": None,
            "attendance_present": 0,
            "attendance_total": 0,
            "scores": [],
        }
    )

    def bucket(day):
        if group_by == "week":
            day -= timedelta(days=(day.weekday() + 2) % 7)
        else:
            day = day.replace(day=1)
        return groups[str(day)]

    for e in mem:
        if valid_verse_range(e["surah"], e["from_ayah"], e["to_ayah"]):
            b = bucket(date.fromisoformat(e["date"]))
            b["memorization_verses"] = (b["memorization_verses"] or 0) + e["new_verses"]
        if e["quantified"] or e["new_pages"] > 0:
            b = bucket(date.fromisoformat(e["date"]))
            b["memorization"] = (b["memorization"] or 0) + e["new_pages"]
    for e in revision:
        if e["pages"] is not None:
            b = bucket(date.fromisoformat(e["date"]))
            b["revision"] = (b["revision"] or 0) + e["pages"]
    for r in daily:
        b = bucket(r.date)
        b["attendance_total"] += 1
        b["attendance_present"] += r.attendance in ("present", "late")
    for e in exams:
        if e["percentage"] is not None:
            bucket(date.fromisoformat(e["date"]))["scores"].append(e["percentage"])
    return [
        {
            "date": key,
            "memorization": b["memorization"],
            "memorization_verses": b["memorization_verses"],
            "revision": b["revision"],
            "attendance": (
                number(b["attendance_present"] / b["attendance_total"] * 100)
                if b["attendance_total"]
                else None
            ),
            "exam": average(b["scores"]),
            "attendance_present": b["attendance_present"],
            "attendance_total": b["attendance_total"],
            "exam_count": len(b["scores"]),
        }
        for key, b in sorted(groups.items())
    ]


def teacher_dataset(teacher_id, filters, detailed=False, student_id=None):
    teacher = get_object_or_404(Teacher.objects.select_related("user"), id=teacher_id)
    roster = (
        Student.objects.filter(teacher=teacher)
        .select_related("user")
        .order_by("full_name", "id")
    )
    total = roster.count()
    active = roster.filter(user__is_active=True).count()
    if student_id:
        roster = roster.filter(id=student_id)
        get_object_or_404(roster)
    else:
        if filters.get("q"):
            roster = roster.filter(full_name__icontains=filters["q"])
        if filters.get("status") in ("active", "inactive"):
            roster = roster.filter(user__is_active=filters["status"] == "active")
    students = list(roster)
    records = load_records(students)
    rows = [
        student_analytics(s, teacher, records[str(s.id)], filters, detailed)
        for s in students
    ]
    for kind in ("memorization", "revision"):
        if filters.get("sort") == kind:
            rows.sort(
                key=lambda r: (
                    (r["memorization_goal"] if kind == "memorization" else r[kind])[
                        "percentage"
                    ]
                    is not None,
                    (r["memorization_goal"] if kind == "memorization" else r[kind])[
                        "percentage"
                    ]
                    or 0,
                ),
                reverse=True,
            )
    summary = {
        "students": len(rows),
        "active_students": sum(r["student"]["active"] for r in rows),
        "recitation_sessions": sum(r["sessions"]["recitation"] for r in rows),
        "memorization": category(
            sum(r["memorization"]["_required_exact"] for r in rows),
            sum(r["memorization"]["_completed_exact"] for r in rows),
            sum(r["memorization"]["unquantified_sessions"] for r in rows),
        ),
        "revision": category(
            sum(r["revision"]["_required_exact"] for r in rows),
            sum(r["revision"]["_completed_exact"] for r in rows),
            sum(r["revision"]["unquantified_sessions"] for r in rows),
        ),
    }
    summary["verse_memorization"] = category(
        sum(r["verse_memorization"]["_required_exact"] for r in rows),
        sum(r["verse_memorization"]["_completed_exact"] for r in rows),
        sum(r["verse_memorization"]["unquantified_sessions"] for r in rows),
    )
    for kind in ("memorization", "revision"):
        summary[kind]["average_percentage"] = average(
            (r["memorization_goal"] if kind == "memorization" else r[kind])[
                "percentage"
            ]
            for r in rows
        )
        summary[kind]["eligible_students"] = sum(
            (r["memorization_goal"] if kind == "memorization" else r[kind])[
                "percentage"
            ]
            is not None
            for r in rows
        )
    for kind in ("memorization", "revision", "verse_memorization"):
        targeted = [r[kind] for r in rows if r[kind]["has_target"]]
        summary[kind]["remaining"] = (
            number(
                sum(
                    max(0, v["_required_exact"] - v["_completed_exact"])
                    for v in targeted
                )
            )
            if targeted and all(v["remaining"] is not None for v in targeted)
            else None
        )
        summary[kind]["percentage"] = average(v["percentage"] for v in targeted)
        if any(not r[kind]["has_target"] and r[kind]["completed"] > 0 for r in rows):
            summary[kind]["percentage"] = None
            summary[kind]["remaining"] = None
    primary = (
        summary["memorization"]
        if summary["memorization"]["has_target"]
        or not summary["verse_memorization"]["has_target"]
        else summary["verse_memorization"]
    )
    summary["memorization_goal"] = {
        **primary,
        "unit": "pages" if primary is summary["memorization"] else "verses",
    }
    summary["attendance"] = {
        k: sum(r["attendance"][k] for r in rows)
        for k in ("present", "late", "absent", "excused", "total")
    }
    a = summary["attendance"]
    a["percentage"] = (
        number((a["present"] + a["late"]) / a["total"] * 100) if a["total"] else None
    )
    count = sum(r["exams"]["graded_count"] for r in rows)
    summary["exams"] = {
        "total": sum(r["exams"]["total"] for r in rows),
        "completed": sum(r["exams"]["completed"] for r in rows),
        "average": (
            number(sum(r["exams"]["score_sum"] for r in rows) / count)
            if count
            else None
        ),
        "graded_count": count,
    }
    trends = defaultdict(
        lambda: {
            "memorization": None,
            "memorization_verses": None,
            "revision": None,
            "attendance_present": 0,
            "attendance_total": 0,
            "exam_sum": 0,
            "exam_count": 0,
        }
    )
    for r in rows:
        for t in r["trends"]:
            b = trends[t["date"]]
            for k in (
                "memorization",
                "memorization_verses",
                "revision",
                "attendance_present",
                "attendance_total",
                "exam_count",
            ):
                if t[k] is not None:
                    b[k] = (b[k] or 0) + t[k]
            b["exam_sum"] += (t["exam"] or 0) * t["exam_count"]
    for row in rows + [summary]:
        for kind in (
            "memorization",
            "revision",
            "verse_memorization",
            "memorization_goal",
        ):
            row[kind].pop("_required_exact", None)
            row[kind].pop("_completed_exact", None)
    return {
        "teacher": {
            "id": str(teacher.id),
            "name": teacher.full_name,
            "ring": teacher.ring_name,
            "phone": teacher.user.phone_number,
            "email": teacher.user.email,
            "joined": str(timezone.localdate(teacher.user.date_joined)),
            "registered_students": total,
            "active_students": active,
        },
        "period": {
            "from": str(filters["from"]) if filters.get("from") else None,
            "to": str(filters["to"]),
            "group_by": filters.get("group_by", "month"),
        },
        "methods": METHODS,
        "summary": summary,
        "students": rows,
        "trends": [
            {
                "date": key,
                "memorization": (
                    number(b["memorization"]) if b["memorization"] is not None else None
                ),
                "memorization_verses": (
                    number(b["memorization_verses"])
                    if b["memorization_verses"] is not None
                    else None
                ),
                "revision": (
                    number(b["revision"]) if b["revision"] is not None else None
                ),
                "attendance": (
                    number(b["attendance_present"] / b["attendance_total"] * 100)
                    if b["attendance_total"]
                    else None
                ),
                "exam": (
                    number(b["exam_sum"] / b["exam_count"]) if b["exam_count"] else None
                ),
            }
            for key, b in sorted(trends.items())
        ],
        "generated_at": timezone.localtime(timezone.now()).isoformat(),
    }
