from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin, IsAdminOrTeacher
from teacher.selectors.teacher_selectors import teacher_list
from teacher.services.excel_import.orchestrator import staff_excel_bulk_import
from teacher.services.teacher_services import teacher_create


class TeacherFilterSerializer(serializers.Serializer):
    search = serializers.CharField(required=False)


class TeacherInputSerializer(serializers.Serializer):
    national_id = serializers.CharField()
    phone_number = serializers.CharField()
    first_name = serializers.CharField(required=False, default="")
    last_name = serializers.CharField(required=False, default="")
    full_name = serializers.CharField()
    specialization = serializers.CharField(required=False, allow_blank=True, default="")
    affiliation = serializers.CharField(required=False, allow_blank=True, default="")
    ring_name = serializers.CharField(required=False, allow_blank=True, default="")
    session_days = serializers.ListField(child=serializers.CharField(), required=False, default=[])
    max_students = serializers.IntegerField(required=False, default=25)
    # No default: when the key is absent the serializer leaves it out of
    # validated_data, so `teacher_update` treats it as "leave the M2M
    # untouched" (see teacher_services.teacher_update). Sending an explicit
    # empty array remains a legitimate "unassign all" signal.
    course_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    wallet_name = serializers.CharField(required=False, allow_blank=True, default="")
    wallet_number = serializers.CharField(required=False, allow_blank=True, default="")
    birthdate = serializers.DateField(required=False, allow_null=True)
    marital_status = serializers.CharField(required=False, allow_blank=True, default="")
    education_qualification = serializers.CharField(required=False, allow_blank=True, default="")
    last_tajweed_course = serializers.CharField(required=False, allow_blank=True, default="")
    family_members_count = serializers.IntegerField(required=False, allow_null=True)
    job_title = serializers.CharField(required=False, allow_blank=True, default="teacher")


class TeacherOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    user_id = serializers.UUIDField(source="user.id")
    national_id = serializers.CharField(source="user.national_id")
    phone_number = serializers.CharField(source="user.phone_number")
    full_name = serializers.CharField()
    specialization = serializers.CharField(allow_blank=True)
    affiliation = serializers.CharField(allow_blank=True)
    ring_name = serializers.CharField(allow_blank=True)
    session_days = serializers.JSONField()
    max_students = serializers.IntegerField()
    courses = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField()
    wallet_name = serializers.CharField(allow_blank=True)
    wallet_number = serializers.CharField(allow_blank=True)
    birthdate = serializers.DateField(allow_null=True)
    marital_status = serializers.CharField(allow_blank=True)
    education_qualification = serializers.CharField(allow_blank=True)
    last_tajweed_course = serializers.CharField(allow_blank=True)
    family_members_count = serializers.IntegerField(allow_null=True)
    job_title = serializers.CharField(allow_blank=True)

    def get_courses(self, obj):
        return [{"id": str(c.id), "name": c.name} for c in obj.courses.all()]


class TeacherListApi(APIView):
    """GET /api/users/teachers/ — قائمة المحفظين"""

    permission_classes = [IsAdminOrTeacher]

    def get(self, request):
        filter_serializer = TeacherFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)

        teachers = teacher_list(filters=filter_serializer.validated_data)

        return Response(
            {"success": True, "data": TeacherOutputSerializer(teachers, many=True).data},
            status=status.HTTP_200_OK,
        )


class TeacherCreateApi(APIView):
    """POST /api/users/teachers/create/ — إنشاء محفظ جديد (مدير فقط)"""

    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = TeacherInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        teacher = teacher_create(creator=request.user, **serializer.validated_data)

        return Response(
            {"success": True, "data": TeacherOutputSerializer(teacher).data},
            status=status.HTTP_201_CREATED,
        )


class TeacherBulkCreateApi(APIView):
    """POST /api/users/teachers/bulk-create/ — استيراد هيكلية المركز.

    Each row is dispatched by job_title:
    - non-teaching titles → StaffMember
    - teaching titles → Teacher (+ User account)
    """

    permission_classes = [IsAdmin]

    def post(self, request):
        rows = request.data.get("rows")
        if not isinstance(rows, list):
            return Response(
                {"success": False, "errors": {"rows": "يجب إرسال قائمة الصفوف."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = staff_excel_bulk_import(creator=request.user, rows=rows)

        return Response(
            {"success": True, "data": result},
            status=status.HTTP_200_OK,
        )
