from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from core.permissions import is_admin_user
from notifications.services.notification_services import notification_create
from students.models import Student, StudentChangeRequest
from students.services.student_services import (
    student_assign_teacher,
    student_create,
    student_delete,
    student_unassign_teacher,
    student_update,
)

_CREATE_REQUIRED_FIELDS = ["full_name", "national_id", "phone_number", "guardian_name", "guardian_mobile"]

_ACTION_LABELS = dict(StudentChangeRequest.Action.choices)


def _notify_admins_of_request(req: StudentChangeRequest) -> None:
    student_name = req.student.full_name if req.student else req.payload.get("full_name", "طالب جديد")
    for admin in User.objects.filter(role="admin"):
        notification_create(
            recipient=admin,
            type="teacher_request",
            title=f"طلب جديد من {req.teacher.full_name}",
            body=f"{_ACTION_LABELS.get(req.action, req.action)} — {student_name}",
        )


def _notify_teacher_of_decision(req: StudentChangeRequest, *, approved: bool) -> None:
    if not req.requested_by:
        return
    student_name = req.student.full_name if req.student else req.payload.get("full_name", "طالب جديد")
    if approved:
        title = "تمت الموافقة على طلبك"
        body = f"{_ACTION_LABELS.get(req.action, req.action)} — {student_name}"
        if req.note:
            body += f"\nملاحظة الإدارة: {req.note}"
    else:
        title = "تم رفض طلبك"
        body = f"{_ACTION_LABELS.get(req.action, req.action)} — {student_name}"
        if req.note:
            body += f"\nسبب الرفض: {req.note}"
    notification_create(recipient=req.requested_by, type="teacher_request", title=title, body=body)


@transaction.atomic
def student_change_request_create(
    *, actor: User, action: str, student_id=None, payload: dict = None
) -> StudentChangeRequest:
    """
    A teacher submits a request (assign/unassign/create/update/delete) that
    only takes effect once an admin approves it (see *_approve below).
    """
    if actor.role != "teacher" or not hasattr(actor, "teacher_profile"):
        raise PermissionDenied("فقط المحفظ يمكنه تقديم هذا الطلب.")

    teacher = actor.teacher_profile
    payload = payload or {}
    student = None

    if action == StudentChangeRequest.Action.CREATE:
        missing = [f for f in _CREATE_REQUIRED_FIELDS if not payload.get(f)]
        if missing:
            raise ValidationError({f: "هذا الحقل مطلوب." for f in missing})
    else:
        if not student_id:
            raise ValidationError({"student_id": "هذا الحقل مطلوب."})
        student = get_object_or_404(Student, id=student_id)

        if action == StudentChangeRequest.Action.ASSIGN:
            if student.teacher_id == teacher.id:
                raise ValidationError({"student_id": "الطالب معيَّن لك بالفعل."})
        elif action in (
            StudentChangeRequest.Action.UNASSIGN,
            StudentChangeRequest.Action.UPDATE,
            StudentChangeRequest.Action.DELETE,
        ):
            if student.teacher_id != teacher.id:
                raise PermissionDenied("هذا الطالب ليس ضمن حلقتك.")
        else:
            raise ValidationError({"action": "إجراء غير معروف."})

    if student and StudentChangeRequest.objects.filter(
        student=student, status=StudentChangeRequest.Status.PENDING
    ).exists():
        raise ValidationError({"action": "يوجد طلب قيد الانتظار لهذا الطالب بالفعل."})

    req = StudentChangeRequest.objects.create(
        teacher=teacher,
        student=student,
        action=action,
        payload=payload,
        requested_by=actor,
    )
    _notify_admins_of_request(req)
    return req


@transaction.atomic
def student_change_request_approve(*, actor: User, request_id, note: str = "") -> StudentChangeRequest:
    """Apply a pending request's effect. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه الموافقة على الطلبات.")

    req = get_object_or_404(
        StudentChangeRequest.objects.select_related("teacher", "student"), id=request_id
    )
    if req.status != StudentChangeRequest.Status.PENDING:
        raise ValidationError({"status": "تمت مراجعة هذا الطلب مسبقاً."})

    previous_teacher = None

    if req.action == StudentChangeRequest.Action.ASSIGN:
        if req.student.teacher_id == req.teacher_id:
            raise ValidationError({"student_id": "الطالب معيَّن لهذا المحفظ بالفعل."})
        previous_teacher = req.student.teacher
        student_assign_teacher(student_id=req.student_id, teacher_id=req.teacher_id, actor=actor)
    elif req.action == StudentChangeRequest.Action.UNASSIGN:
        if req.student.teacher_id != req.teacher_id:
            raise ValidationError({"student_id": "الطالب لم يعد ضمن حلقة هذا المحفظ."})
        student_unassign_teacher(student_id=req.student_id, actor=actor)
    elif req.action == StudentChangeRequest.Action.CREATE:
        current_count = Student.objects.filter(teacher=req.teacher).count()
        if current_count >= req.teacher.max_students:
            raise ValidationError(
                {"teacher_id": f"المحفظ وصل للحد الأقصى ({req.teacher.max_students} طالب)."}
            )
        new_student = student_create(creator=actor, **{**req.payload, "teacher_id": str(req.teacher_id)})
        req.student = new_student
    elif req.action == StudentChangeRequest.Action.UPDATE:
        student_update(student=req.student, actor=actor, data=req.payload)
    elif req.action == StudentChangeRequest.Action.DELETE:
        req.payload = {"full_name": req.student.full_name}
        student_delete(student_id=req.student_id, actor=actor)

    req.status = StudentChangeRequest.Status.APPROVED
    req.reviewed_by = actor
    req.reviewed_at = timezone.now()
    if note:
        req.note = note
    req.save()

    _notify_teacher_of_decision(req, approved=True)
    if previous_teacher and previous_teacher.user_id:
        notification_create(
            recipient=previous_teacher.user,
            type="teacher_request",
            title="تم نقل طالب من حلقتك",
            body=f"تم نقل الطالب {req.student.full_name} إلى محفظ آخر بموافقة الإدارة.",
        )
    return req


@transaction.atomic
def student_change_request_reject(*, actor: User, request_id, note: str = "") -> StudentChangeRequest:
    """Reject a pending request. Admin only."""
    if not is_admin_user(actor):
        raise PermissionDenied("فقط المدير يمكنه رفض الطلبات.")

    req = get_object_or_404(StudentChangeRequest, id=request_id)
    if req.status != StudentChangeRequest.Status.PENDING:
        raise ValidationError({"status": "تمت مراجعة هذا الطلب مسبقاً."})

    req.status = StudentChangeRequest.Status.REJECTED
    req.reviewed_by = actor
    req.reviewed_at = timezone.now()
    req.note = note
    req.save()

    _notify_teacher_of_decision(req, approved=False)
    return req


@transaction.atomic
def student_change_request_cancel(*, actor: User, request_id) -> None:
    """A teacher withdraws their own still-pending request."""
    req = get_object_or_404(StudentChangeRequest, id=request_id)
    if actor.role != "teacher" or not hasattr(actor, "teacher_profile") or req.teacher_id != actor.teacher_profile.id:
        raise PermissionDenied("لا يمكنك سحب طلب لا يخصك.")
    if req.status != StudentChangeRequest.Status.PENDING:
        raise ValidationError({"status": "لا يمكن سحب طلب تمت مراجعته بالفعل."})
    req.delete()
