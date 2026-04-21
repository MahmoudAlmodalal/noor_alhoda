from django.db.models import QuerySet
from django.shortcuts import get_object_or_404

from accounts.models import User
from teacher.models import Teacher


def teacher_list(*, filters: dict) -> QuerySet[Teacher]:
    """Return filtered list of teachers."""
    qs = Teacher.objects.select_related("user").prefetch_related("courses").all()

    search = filters.get("search")
    if search:
        qs = qs.filter(full_name__icontains=search)

    return qs


def teacher_get(*, teacher_id, actor: User) -> Teacher:
    """Fetch a single teacher with related user + courses."""
    return get_object_or_404(
        Teacher.objects.select_related("user").prefetch_related("courses"),
        id=teacher_id,
    )
