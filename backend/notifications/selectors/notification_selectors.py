import uuid
from django.db.models import QuerySet

from notifications.models import Notification
from accounts.models import Parent, ParentStudentLink, User
from students.models import Student
from teacher.models import Teacher


def notification_list(*, user: User) -> QuerySet[Notification]:
    """Return all notifications for a user, ordered by newest first."""
    return Notification.objects.filter(recipient=user).order_by("-created_at")


def notification_unread_count(*, user: User) -> int:
    """Return count of unread notifications for a user."""
    return Notification.objects.filter(recipient=user, is_read=False).count()


def announcement_recipients(
    *,
    sender: User,
    target_user_ids: list | None = None,
    target_roles: list | None = None,
) -> QuerySet[User]:
    """
    Resolve announcement recipients by explicit user ids, role filter, or
    fallback to all users except the sender.
    """
    if target_user_ids:
        return User.objects.filter(id__in=target_user_ids)
    if target_roles:
        return User.objects.filter(role__in=target_roles)
    return User.objects.all().exclude(id=sender.id)


def parents_of_student_with_phone(
    *, student: Student
) -> list[tuple[Parent, User, str]]:
    """
    (parent, parent_user, phone) tuples for a student's linked parents.
    Phone is parent.phone_number or user.phone_number (may be empty string).
    """
    links = student.parent_links.select_related("parent", "parent__user").all()
    result = []
    for link in links:
        parent = link.parent
        parent_user = parent.user
        phone = parent.phone_number or parent_user.phone_number or ""
        result.append((parent, parent_user, str(phone)))
    return result


def student_get_by_id(student_id: str | uuid.UUID) -> Student | None:
    """Return Student instance by student_id or None if not found."""
    try:
        return Student.objects.select_related("user", "teacher").get(id=student_id)
    except (Student.DoesNotExist, ValueError, TypeError):
        return None


def student_user_get_by_id(student_id: str | uuid.UUID) -> User | None:
    """Return linked User instance for a student_id or None."""
    student = student_get_by_id(student_id)
    if student and hasattr(student, "user") and student.user:
        return student.user
    return None


def parent_users_get_for_student(
    student: Student | str | uuid.UUID | None = None,
    student_id: str | uuid.UUID | None = None,
) -> list[User]:
    """
    Return linked parent User instances for a student instance or student_id.
    """
    target = student or student_id
    if not target:
        return []

    if isinstance(target, Student):
        student_obj = target
    else:
        student_obj = student_get_by_id(target)

    if not student_obj:
        return []

    links = ParentStudentLink.objects.filter(student=student_obj).select_related("parent__user")
    parent_users = []
    for link in links:
        if link.parent and link.parent.user:
            parent_users.append(link.parent.user)
    return parent_users


def teacher_can_message_student(
    teacher_user: User,
    student: Student | str | uuid.UUID | None = None,
    student_id: str | uuid.UUID | None = None,
) -> bool:
    """
    Verify if teacher_user is authorized to message the specified student.
    Returns True if teacher_user has a teacher profile and is assigned as the student's teacher.
    """
    if not hasattr(teacher_user, "teacher_profile") or not teacher_user.teacher_profile:
        return False

    target = student or student_id
    if not target:
        return False

    if isinstance(target, Student):
        student_obj = target
    else:
        student_obj = student_get_by_id(target)

    if not student_obj or not student_obj.teacher_id:
        return False

    return student_obj.teacher_id == teacher_user.teacher_profile.id


def teacher_circle_recipients(teacher_user: User) -> list[User]:
    """
    Return all User accounts (student + parent) in the teacher's circle.
    Includes: user accounts of active students assigned to this teacher,
    plus user accounts of parents linked to those students.
    """
    if not hasattr(teacher_user, "teacher_profile") or not teacher_user.teacher_profile:
        return []

    teacher: Teacher = teacher_user.teacher_profile

    # جلب الطلاب المُعيَّنين لهذا المحفظ الذين لديهم حساب مستخدم
    students = (
        Student.objects.filter(teacher=teacher)
        .select_related("user")
        .prefetch_related("parent_links__parent__user")
    )

    recipients: list[User] = []
    seen_ids: set = set()

    for student in students:
        # حساب الطالب
        if student.user_id and student.user_id not in seen_ids:
            recipients.append(student.user)
            seen_ids.add(student.user_id)

        # حسابات أولياء الأمور
        for link in student.parent_links.all():
            parent_user = getattr(link.parent, "user", None)
            if parent_user and parent_user.id not in seen_ids:
                recipients.append(parent_user)
                seen_ids.add(parent_user.id)

    return recipients


def conversation_messages(*, student_id, user):
    """
    جلب كل رسائل المحادثة مع طالب معين.
    """
    from notifications.models import DirectMessage
    return DirectMessage.objects.filter(
        student_id=student_id,
    ).select_related("sender").order_by("created_at")


def conversation_list_for_user(*, user) -> list:
    """
    جلب قائمة المحادثات النشطة للمستخدم.
    يعيد قائمة بالطلاب اللي فيه رسائل معهم مع آخر رسالة وعدد الغير مقروءة.
    """
    from notifications.models import DirectMessage
    from core.permissions import is_admin_user

    if user.role == "student":
        student_profile = getattr(user, "student_profile", None)
        if not student_profile:
            return []
        student_ids = list(
            DirectMessage.objects.filter(
                student=student_profile,
            ).values_list("student_id", flat=True).distinct()
        )
    elif user.role == "teacher":
        teacher_profile = getattr(user, "teacher_profile", None)
        if not teacher_profile:
            return []
        student_ids = list(
            DirectMessage.objects.filter(
                student__teacher=teacher_profile,
            ).values_list("student_id", flat=True).distinct()
        )
    elif is_admin_user(user):
        student_ids = list(
            DirectMessage.objects.values_list(
                "student_id", flat=True
            ).distinct()
        )
    else:
        return []

    # Keep the invariant explicit even if a future query or join introduces
    # duplicate student IDs despite SQL DISTINCT.
    student_ids = list(dict.fromkeys(student_ids))

    conversations = []
    for sid in student_ids:
        student = student_get_by_id(sid)
        if not student:
            continue

        last_msg = DirectMessage.objects.filter(
            student_id=sid
        ).order_by("-created_at").first()

        unread_count = DirectMessage.objects.filter(
            student_id=sid,
            is_read=False,
        ).exclude(sender=user).count()

        if last_msg:
            conversations.append({
                "student_id": str(sid),
                "student_name": student.full_name,
                "last_message": last_msg.body[:100],
                "last_message_at": last_msg.created_at.isoformat(),
                "last_sender_role": last_msg.sender_role,
                "unread_count": unread_count,
            })

    conversations.sort(key=lambda c: c["last_message_at"], reverse=True)
    return conversations
