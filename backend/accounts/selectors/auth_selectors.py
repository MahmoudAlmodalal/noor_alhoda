from django.shortcuts import get_object_or_404

from backend.accounts.models import User


def user_get_by_phone(*, phone: str) -> User:
    """Get a user by phone number. Raises 404 if not found."""
    return get_object_or_404(User, phone_number=phone, is_active=True)


def user_get_me(*, user: User) -> dict:
    """
    Return profile data for the current authenticated user,
    including role-specific info (teacher profile, parent links, etc.).
    """
    data = {
        "id": str(user.id),
        "username": user.username,
        "phone_number": user.phone_number,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_active": user.is_active,
        "date_joined": user.date_joined.isoformat(),
    }

    if user.role == "teacher" and hasattr(user, "teacher_profile"):
        teacher = user.teacher_profile
        data["teacher_profile"] = {
            "id": str(teacher.id),
            "full_name": teacher.full_name,
            "specialization": teacher.specialization,
            "session_days": teacher.session_days,
            "max_students": teacher.max_students,
        }

    elif user.role == "parent" and hasattr(user, "parent_profile"):
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

    elif user.role == "student":
        try:
            student = user.student_profile
            data["student_profile"] = {
                "id": str(student.id),
                "full_name": student.full_name,
                "grade": student.grade,
                "enrollment_date": str(student.enrollment_date),
            }
        except Exception:
            pass

    return data
