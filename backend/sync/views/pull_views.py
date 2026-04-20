from datetime import datetime

from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from sync.services.pull_services import sync_pull


class SyncPullApi(APIView):
    """
    GET /api/sync/pull/?since=<iso8601>

    Returns the delta of all records the actor can see (role-filtered by
    existing selectors), plus tombstones for hard-deleted rows whose
    scope includes the actor. Omit `since` for an initial full pull.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        since_raw = request.query_params.get("since")
        since: datetime | None = None
        if since_raw:
            since = parse_datetime(since_raw)
            if since is None:
                return Response(
                    {
                        "success": False,
                        "error": "صيغة التاريخ غير صحيحة؛ استخدم ISO-8601.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        data = sync_pull(actor=request.user, since=since)
        return Response({"success": True, "data": data}, status=status.HTTP_200_OK)
