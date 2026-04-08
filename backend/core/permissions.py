from rest_framework.permissions import BasePermission


def is_admin_user(user) -> bool:
    """Return True for app admins and Django superusers."""
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and (getattr(user, "role", None) == "admin" or getattr(user, "is_superuser", False))
    )


class IsAdmin(BasePermission):
    """Allow access only to admin users."""

    def has_permission(self, request, view):
        return is_admin_user(request.user)


class IsTeacher(BasePermission):
    """Allow access only to teacher users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "teacher"
        )


class IsStudent(BasePermission):
    """Allow access only to student users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "student"
        )


class IsParent(BasePermission):
    """Allow access only to parent users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "parent"
        )


class IsAdminOrTeacher(BasePermission):
    """Allow access to admin or teacher users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (is_admin_user(request.user) or request.user.role == "teacher")
        )


class IsAdminOrTeacherOrSelf(BasePermission):
    """Allow admin, teacher, or the student themselves."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
