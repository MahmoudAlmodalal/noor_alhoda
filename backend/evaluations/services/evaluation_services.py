from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import User
from core.permissions import is_admin_user
from evaluations.models import Evaluation
from students.models import Student


def _check_teacher_of_student(*, actor: User, student: Student) -> None:
    """Admin passes. Teacher must own student."""
    if is_admin_user(actor):
        return
    if actor.role == "teacher":
        if not hasattr(actor, "teacher_profile") or student.teacher_id != actor.teacher_profile.id:
            raise PermissionDenied("لا يمكنك إدارة اختبار لطالب ليس في حلقتك.")
        return
    raise PermissionDenied("ليس لديك صلاحية لإدارة الاختبارات.")


@transaction.atomic
def evaluation_create(
    *,
    student_id,
    title: str,
    scheduled_date,
    surah_range: str = "",
    actor: User,
    id=None,
) -> Evaluation:
    if not title or not str(title).strip():
        raise ValidationError({"title": "عنوان الاختبار مطلوب."})

    try:
        student = Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        raise ValidationError({"student_id": "الطالب غير موجود."})

    _check_teacher_of_student(actor=actor, student=student)

    ev_kwargs = dict(
        student=student,
        title=str(title).strip(),
        surah_range=surah_range or "",
        scheduled_date=scheduled_date,
        created_by=actor,
    )
    if id is not None:
        ev_kwargs["id"] = id
    ev = Evaluation(**ev_kwargs)
    ev.full_clean()
    ev.save()
    return ev


@transaction.atomic
def evaluation_update(
    *,
    actor: User,
    evaluation: Evaluation | None = None,
    evaluation_id=None,
    data: dict | None = None,
) -> Evaluation:
    """
    Update an evaluation. Accepts either a live `evaluation` instance or an
    `evaluation_id` lookup (kept for back-compat with older call sites).
    """
    if evaluation is None:
        if evaluation_id is None:
            raise ValidationError("يجب تحديد الاختبار.")
        try:
            evaluation = Evaluation.objects.select_related("student").get(id=evaluation_id)
        except Evaluation.DoesNotExist:
            raise ValidationError("الاختبار غير موجود.")

    _check_teacher_of_student(actor=actor, student=evaluation.student)

    allowed = ["title", "surah_range", "scheduled_date", "status", "result_note"]
    for field, value in (data or {}).items():
        if field in allowed:
            setattr(evaluation, field, value)
    evaluation.full_clean()
    evaluation.save()
    return evaluation


@transaction.atomic
def evaluation_delete(*, evaluation: Evaluation, actor: User) -> None:
    """Delete an evaluation. Admin or owning teacher only."""
    _check_teacher_of_student(actor=actor, student=evaluation.student)

    from sync.models import Tombstone
    from sync.services.tombstone_service import tombstone_write

    deleted_uuid = evaluation.id
    evaluation.delete()
    tombstone_write(
        resource=Tombstone.Resource.EVALUATION,
        resource_uuid=deleted_uuid,
        actor=actor,
        scope_user_id=None,
    )
