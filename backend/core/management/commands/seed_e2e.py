from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import OTPCode, Teacher, User
from courses.models import Course, StudentCourse
from notifications.models import Notification
from records.models import DailyRecord, WeeklyPlan
from students.models import Student

E2E_PHONES = {
    "admin": "0599100001",
    "teacher": "0599100010",
    "teacher_two": "0599100011",
    "student": "0599100020",
    "student_two": "0599100021",
    "student_unassigned": "0599100022",
}

E2E_IDS = {
    "teacher": "11111111-1111-4111-8111-111111111111",
    "teacher_two": "22222222-2222-4222-8222-222222222222",
    "student": "33333333-3333-4333-8333-333333333333",
    "student_two": "44444444-4444-4444-8444-444444444444",
    "student_unassigned": "55555555-5555-4555-8555-555555555555",
    "course": "88888888-8888-4888-8888-888888888888",
    "course_two": "99999999-9999-4999-8999-999999999999",
}

def _last4(phone):
    return phone[-4:]

E2E_PASSWORDS = {k: _last4(v) for k, v in E2E_PHONES.items()}

E2E_COURSE_NAMES = [
    "التجويد التأسيسي - E2E",
    "مخارج الحروف - E2E",
]

class Command(BaseCommand):
    help = "Seed deterministic application data for browser and integration tests."

    def add_arguments(self, parser):
        parser.add_argument(
            "--otp-code",
            default=None,
            help="Optionally create a known OTP code for the seeded student user.",
        )
        parser.add_argument(
            "--quiet",
            action="store_true",
            help="Suppress the human-readable summary output.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        quiet = options["quiet"]
        otp_code = options.get("otp_code")

        self._clear_fixture_data()
        seeded = self._seed_fixture_data()

        if otp_code:
            self._seed_known_otp(user=seeded["student_user"], code=otp_code)

        if quiet:
            return

        self.stdout.write(self.style.SUCCESS("Seeded deterministic E2E fixtures."))
        self.stdout.write(
            "\n".join(
                [
                    f"Admin:        {E2E_PHONES['admin']} / {E2E_PASSWORDS['admin']}",
                    f"Teacher One:  {E2E_PHONES['teacher']} / {E2E_PASSWORDS['teacher']}",
                    f"Teacher Two:  {E2E_PHONES['teacher_two']} / {E2E_PASSWORDS['teacher_two']}",
                    f"Student One:  {E2E_PHONES['student']} / {E2E_PASSWORDS['student']}",
                    f"Student Two:  {E2E_PHONES['student_two']} / {E2E_PASSWORDS['student_two']}",
                    f"Student Three:{E2E_PHONES['student_unassigned']} / {E2E_PASSWORDS['student_unassigned']}",
                ]
            )
        )
        if otp_code:
            self.stdout.write(f"Known OTP for seeded student: {otp_code}")

    def _clear_fixture_data(self):
        User.objects.filter(phone_number__in=E2E_PHONES.values()).delete()
        Course.objects.filter(name__in=E2E_COURSE_NAMES).delete()

    def _seed_fixture_data(self):
        today = timezone.localdate()
        weekday = today.weekday()
        days_since_saturday = (weekday + 2) % 7
        current_week_start = today - timedelta(days=days_since_saturday)
        previous_week_start = current_week_start - timedelta(days=7)

        admin = User.objects.create_superuser(
            national_id=E2E_PHONES["admin"],
            phone_number=E2E_PHONES["admin"],
            password=E2E_PASSWORDS["admin"],
            first_name="Admin",
            last_name="E2E",
            role="admin",
            is_active=True,
        )

        teacher_user = User.objects.create_user(
            national_id=E2E_PHONES["teacher"],
            phone_number=E2E_PHONES["teacher"],
            password=E2E_PASSWORDS["teacher"],
            first_name="Teacher",
            last_name="One",
            role="teacher",
            is_active=True,
        )
        teacher = Teacher.objects.create(
            id=E2E_IDS["teacher"],
            user=teacher_user,
            full_name="Teacher One",
            specialization="إجازة في التجويد",
            session_days=["sat", "sun", "mon", "tue", "wed", "thu"],
            max_students=25,
        )

        teacher_two_user = User.objects.create_user(
            national_id=E2E_PHONES["teacher_two"],
            phone_number=E2E_PHONES["teacher_two"],
            password=E2E_PASSWORDS["teacher_two"],
            first_name="Teacher",
            last_name="Two",
            role="teacher",
            is_active=True,
        )
        teacher_two = Teacher.objects.create(
            id=E2E_IDS["teacher_two"],
            user=teacher_two_user,
            full_name="Teacher Two",
            specialization="تحفيظ",
            session_days=["sat", "sun", "mon", "tue", "wed", "thu"],
            max_students=25,
        )

        student_user = User.objects.create_user(
            national_id=E2E_PHONES["student"],
            phone_number=E2E_PHONES["student"],
            password=E2E_PASSWORDS["student"],
            first_name="Student",
            last_name="One",
            role="student",
            is_active=True,
        )
        student = Student.objects.create(
            id=E2E_IDS["student"],
            user=student_user,
            full_name="Student One",
            national_id="E2E-STU-001",
            birthdate=today - timedelta(days=12 * 365),
            grade="Grade 7",
            mobile=E2E_PHONES["student"],
            guardian_name="Guardian One",
            guardian_mobile="0599100030",
            teacher=teacher,
            skills={"quran": True, "nasheed": False, "poetry": True, "other": False},
        )

        student_two_user = User.objects.create_user(
            national_id=E2E_PHONES["student_two"],
            phone_number=E2E_PHONES["student_two"],
            password=E2E_PASSWORDS["student"],
            first_name="Student",
            last_name="Two",
            role="student",
            is_active=True,
        )
        student_two = Student.objects.create(
            id=E2E_IDS["student_two"],
            user=student_two_user,
            full_name="Student Two",
            national_id="E2E-STU-002",
            birthdate=today - timedelta(days=11 * 365),
            grade="Grade 8",
            mobile=E2E_PHONES["student_two"],
            guardian_name="Guardian Two",
            guardian_mobile="0599100031",
            teacher=teacher_two,
            skills={"quran": True, "nasheed": True, "poetry": False, "other": False},
        )

        student_unassigned_user = User.objects.create_user(
            national_id=E2E_PHONES["student_unassigned"],
            phone_number=E2E_PHONES["student_unassigned"],
            password=E2E_PASSWORDS["student"],
            first_name="Student",
            last_name="Three",
            role="student",
            is_active=True,
        )
        student_unassigned = Student.objects.create(
            id=E2E_IDS["student_unassigned"],
            user=student_unassigned_user,
            full_name="Student Three",
            national_id="E2E-STU-003",
            birthdate=today - timedelta(days=10 * 365),
            grade="Grade 6",
            mobile=E2E_PHONES["student_unassigned"],
            guardian_name="Guardian Three",
            guardian_mobile="0599100032",
            teacher=None,
            skills={"quran": False, "nasheed": True, "poetry": False, "other": False},
        )

        tajweed = Course.objects.create(
            id=E2E_IDS["course"],
            name=E2E_COURSE_NAMES[0],
            description="أساسيات أحكام التجويد.",
        )
        articulation = Course.objects.create(
            id=E2E_IDS["course_two"],
            name=E2E_COURSE_NAMES[1],
            description="تدريب على مخارج الحروف وصفاتها.",
        )
        StudentCourse.objects.create(
            student=student,
            course=tajweed,
            is_completed=True,
            completion_date=today - timedelta(days=14),
        )
        StudentCourse.objects.create(
            student=student,
            course=articulation,
            is_completed=False,
        )

        current_plan = WeeklyPlan.objects.create(
            student=student,
            week_number=current_week_start.isocalendar()[1],
            week_start=current_week_start,
        )
        previous_plan = WeeklyPlan.objects.create(
            student=student,
            week_number=previous_week_start.isocalendar()[1],
            week_start=previous_week_start,
        )
        other_plan = WeeklyPlan.objects.create(
            student=student_two,
            week_number=current_week_start.isocalendar()[1],
            week_start=current_week_start,
        )

        self._create_week_records(
            plan=current_plan,
            recorder=teacher_user,
            start_date=current_week_start,
            entries=[
                ("sat", "present", 5, 5, "الملك", "excellent", "ممتاز"),
                ("sun", "late", 4, 4, "القلم", "good", "حضور متأخر"),
                ("mon", "absent", 6, 0, "الحاقة", "none", "غاب بعذر"),
            ],
        )
        self._create_week_records(
            plan=previous_plan,
            recorder=teacher_user,
            start_date=previous_week_start,
            entries=[
                ("sat", "present", 4, 4, "النبأ", "excellent", "أداء متقن"),
                ("sun", "present", 4, 3, "النازعات", "acceptable", "يحتاج متابعة"),
            ],
        )
        self._create_week_records(
            plan=other_plan,
            recorder=teacher_two_user,
            start_date=current_week_start,
            entries=[
                ("sat", "present", 3, 3, "عبس", "good", "منجز"),
            ],
        )

        Notification.objects.create(
            recipient=admin,
            type="announcement",
            title="إشعار إداري - E2E",
            body="متابعة لوحة التحكم.",
            is_read=False,
        )
        Notification.objects.create(
            recipient=teacher_user,
            type="announcement",
            title="إعلان للمعلمين - E2E",
            body="تم تحديث جدول الحلقات.",
            is_read=False,
        )
        Notification.objects.create(
            recipient=student_user,
            type="reminder",
            title="تذكير واجب - E2E",
            body="راجع حفظ هذا الأسبوع.",
            is_read=False,
        )

        return {
            "admin": admin,
            "teacher": teacher,
            "teacher_user": teacher_user,
            "student": student,
            "student_user": student_user,
            "student_two": student_two,
            "student_unassigned": student_unassigned,
        }

    def _create_week_records(self, *, plan, recorder, start_date, entries):
        offsets = {
            "sat": 0,
            "sun": 1,
            "mon": 2,
            "tue": 3,
            "wed": 4,
            "thu": 5,
        }
        for day, attendance, required, achieved, surah, quality, note in entries:
            DailyRecord.objects.create(
                weekly_plan=plan,
                day=day,
                date=start_date + timedelta(days=offsets[day]),
                attendance=attendance,
                required_verses=required,
                achieved_verses=achieved,
                surah_name=surah,
                quality=quality,
                note=note,
                recorded_by=recorder,
            )

    def _seed_known_otp(self, *, user: User, code: str):
        OTPCode.objects.filter(user=user, is_used=False).update(is_used=True)
        OTPCode.objects.create(
            user=user,
            code_hash=OTPCode.hash_code(code),
            expires_at=timezone.now() + timedelta(minutes=10),
            is_used=False,
        )
