import logging

from django.core.exceptions import ObjectDoesNotExist
from django.shortcuts import get_object_or_404

from accounts.models import User
from core.permissions import is_admin_user

logger = logging.getLogger(__name__)


def user_get_by_national_id(*, national_id: str) -> User:
    """Get a user by national ID. Raises 404 if not found."""
    return get_object_or_404(User, national_id=national_id)


def user_get_me(*, user: User) -> dict:
    """
    Return profile data for the current authenticated user,
    including role-specific info (teacher profile, parent links, etc.).
    """
    role = "admin" if is_admin_user(user) else user.role

    data = {
        "id": str(user.id),
        "national_id": user.national_id,
        "phone_number": user.phone_number,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": role,
        "date_joined": user.date_joined.isoformat(),
    }

    if role == "teacher" and hasattr(user, "teacher_profile"):
        teacher = user.teacher_profile
        data["teacher_profile"] = {
            "id": str(teacher.id),
            "full_name": teacher.full_name,
            "specialization": teacher.specialization,
            "session_days": teacher.session_days,
            "max_students": teacher.max_students,
        }

    elif role == "parent" and hasattr(user, "parent_profile"):
        parent = user.parent_profile
        children = parent.student_links.select_related("student").all()
        data["parent_profile"] = {
            "id": str(parent.id),
            "full_name": parent.full_name,
            "children": [
                {
                    "student_id": str(link.student.id),
                    "student_name": link.student.full_name,
                }
                for link in children
            ],
        }

    elif role == "student":
        try:
            student = user.student_profile
            data["student_profile"] = {
                "id": str(student.id),
                "full_name": student.full_name,
                "grade": student.grade,
                "enrollment_date": str(student.enrollment_date),
            }
        except ObjectDoesNotExist:
            logger.warning("Student user %s has no student_profile", user.id)

    return data
