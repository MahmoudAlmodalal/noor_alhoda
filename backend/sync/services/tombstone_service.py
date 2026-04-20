from django.db import transaction

from accounts.models import User
from sync.models import Tombstone


@transaction.atomic
def tombstone_write(
    *,
    resource: str,
    resource_uuid,
    actor: User | None = None,
    scope_user_id=None,
) -> Tombstone:
    """
    Record a tombstone for a hard-deleted row. Must be called inside the
    same transaction as the delete so the two commit atomically.

    `resource` must be one of `Tombstone.Resource`. `scope_user_id` is an
    optional hint for the pull endpoint (e.g., the owning teacher's UUID
    for a DailyRecord); left null for rows visible to all authenticated
    users (courses, etc.).
    """
    return Tombstone.objects.create(
        resource=resource,
        resource_uuid=resource_uuid,
        deleted_by=actor if actor and actor.is_authenticated else None,
        scope_user_id=scope_user_id,
    )
