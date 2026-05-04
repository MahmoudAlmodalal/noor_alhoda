from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StaffMember
from core.permissions import IsAdmin


class StaffMemberOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    national_id = serializers.CharField()
    phone_number = serializers.CharField(allow_blank=True)
    birthdate = serializers.DateField(allow_null=True)
    marital_status = serializers.CharField(allow_blank=True)
    education_qualification = serializers.CharField(allow_blank=True)
    last_tajweed_course = serializers.CharField(allow_blank=True)
    family_members_count = serializers.IntegerField(allow_null=True)
    wallet_name = serializers.CharField(allow_blank=True)
    wallet_number = serializers.CharField(allow_blank=True)
    job_title = serializers.CharField()
    job_title_display = serializers.CharField(source="get_job_title_display")
    user_id = serializers.UUIDField(source="user.id", default=None, allow_null=True)
    created_at = serializers.DateTimeField()


class StaffMemberListApi(APIView):
    """GET /api/users/staff-members/ — قائمة الموظفين غير المحفظين (مدير فقط)."""

    permission_classes = [IsAdmin]

    def get(self, request):
        staff = StaffMember.objects.select_related("user").all()
        return Response(
            {
                "success": True,
                "data": StaffMemberOutputSerializer(staff, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
