from accounts.models import User
from sync.models import IdempotencyKey


def idempotency_get(*, op_id, user: User) -> IdempotencyKey | None:
    """Return the cached result row for a replayed op, or None on first run."""
    return IdempotencyKey.objects.filter(op_id=op_id, user=user).first()
