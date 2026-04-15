from django.core.paginator import Paginator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

from core.permissions import IsAdmin, IsAdminOrTeacher, IsAdminOrTeacherOrSelf
from students.selectors.student_selectors import (
    student_list,
    student_get,
    student_history,
    student_stats,
)
from students.services.student_services import (
    student_create,
    student_update,
    student_delete,
    student_assign_teacher,
    student_link_parent,
    student_bulk_create,
)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
class StudentFilterSerializer(serializers.Serializer):
    teacher_id = serializers.UUIDField(required=False)
    course_id = serializers.UUIDField(required=False)
    grade = serializers.CharField(required=False)
    search = serializers.CharField(required=False)
    paginated = serializers.BooleanField(required=False, default=False)
    page = serializers.IntegerField(required=False, default=1, min_value=1)


class StudentInputSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    full_name = serializers.CharField()
    national_id = serializers.CharField()
    birthdate = serializers.DateField()
    grade = serializers.CharField()
    address = serializers.CharField(required=False, allow_blank=True, default="")
    whatsapp = serializers.CharField(required=False, allow_blank=True, default="")
    mobile = serializers.CharField(required=False, allow_blank=True, default="")
    previous_courses = serializers.CharField(required=False, allow_blank=True, default="")
    desired_courses = serializers.CharField(required=False, allow_blank=True, default="")
    bank_account_number = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    bank_account_name = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    bank_account_type = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    guardian_name = serializers.CharField()
    guardian_national_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    guardian_mobile = serializers.CharField()
    teacher_id = serializers.UUIDField(required=False, allow_null=True)
    health_status = serializers.CharField(required=False, allow_blank=True, default="normal")
    health_note = serializers.CharField(required=False, allow_blank=True, default="")
    skills = serializers.JSONField(required=False, default=dict)
    password = serializers.CharField(required=False, allow_blank=True, default="")


class StudentOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    national_id = serializers.CharField()
    birthdate = serializers.DateField()
    grade = serializers.CharField()
    address = serializers.CharField()
    whatsapp = serializers.CharField()
    mobile = serializers.CharField()
    previous_courses = serializers.CharField()
    desired_courses = serializers.CharField()
    bank_account_number = serializers.CharField()
    bank_account_name = serializers.CharField()
    bank_account_type = serializers.CharField()
    guardian_name = serializers.CharField()
    guardian_national_id = serializers.CharField()
    guardian_mobile = serializers.CharField()
    teacher_id = serializers.UUIDField(source="teacher.id", default=None)
    teacher_name = serializers.CharField(source="teacher.full_name", default=None)
    health_status = serializers.CharField()
    health_note = serializers.CharField()
    affiliation = serializers.CharField(source="teacher.affiliation", default="")
    skills = serializers.JSONField()

    enrollment_date = serializers.DateField()


class StudentUpdateSerializer(serializers.Serializer):
    """Serializer for updating student data with all editable fields."""
    # Personal Information
    full_name = serializers.CharField(required=False, allow_blank=True)
    national_id = serializers.CharField(required=False, allow_blank=True)
    birthdate = serializers.DateField(required=False, allow_null=True)
    grade = serializers.CharField(required=False, allow_blank=True)
    
    # Contact Information
    address = serializers.CharField(required=False, allow_blank=True)
    whatsapp = serializers.CharField(required=False, allow_blank=True)
    mobile = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    
    # Academic Information
    previous_courses = serializers.CharField(required=False, allow_blank=True)
    desired_courses = serializers.CharField(required=False, allow_blank=True)
    
    # Bank Account Information
    bank_account_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    bank_account_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    bank_account_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    
    # Guardian Information
    guardian_name = serializers.CharField(required=False, allow_blank=True)
    guardian_national_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    guardian_mobile = serializers.CharField(required=False, allow_blank=True)
    
    # Health and Skills
    health_status = serializers.CharField(required=False, allow_blank=True)
    health_note = serializers.CharField(required=False, allow_blank=True)
    skills = serializers.JSONField(required=False, allow_null=True)


class AssignTeacherSerializer(serializers.Serializer):
    teacher_id = serializers.UUIDField()


class LinkParentSerializer(serializers.Serializer):
    parent_id = serializers.UUIDField()


class WeeklyPlanOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    week_number = serializers.IntegerField()
    week_start = serializers.DateField()
    total_required = serializers.IntegerField()
    total_achieved = serializers.IntegerField()
    completion_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    created_at = serializers.DateTimeField()


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class StudentListApi(APIView):
    """GET /api/students/ — قائمة الطلاب مع البحث والفلترة"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request):
        filter_serializer = StudentFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)

        filters = filter_serializer.validated_data
        students = student_list(
            filters=filters,
            user=request.user,
        )

        if filters.get("paginated"):
            paginator = Paginator(students, 25)
            page_obj = paginator.get_page(filters.get("page", 1))
            data = {
                "items": StudentOutputSerializer(page_obj.object_list, many=True).data,
                "count": paginator.count,
                "page": page_obj.number,
                "page_size": 25,
                "total_pages": paginator.num_pages,
            }
        else:
            data = StudentOutputSerializer(students, many=True).data

        return Response(
            {"success": True, "data": data},
            status=status.HTTP_200_OK,
        )


class StudentCreateApi(APIView):
    """POST /api/students/ — إنشاء طالب جديد"""

    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = StudentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student = student_create(creator=request.user, **serializer.validated_data)

        return Response(
            {"success": True, "data": StudentOutputSerializer(student).data},
            status=status.HTTP_201_CREATED,
        )


class StudentBulkCreateSerializer(serializers.Serializer):
    rows = serializers.ListField(
        child=serializers.DictField(), allow_empty=False
    )


class StudentBulkCreateApi(APIView):
    """POST /api/students/bulk-create/ — استيراد دفعة طلاب من Excel"""

    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = StudentBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = student_bulk_create(
            creator=request.user,
            rows=serializer.validated_data["rows"],
        )

        return Response(
            {"success": True, "data": result},
            status=status.HTTP_201_CREATED,
        )


class StudentDetailApi(APIView):
    """
    GET /api/students/<id>/ — بيانات طالب واحد
    PATCH /api/students/<id>/ — تعديل بيانات الطالب
    DELETE /api/students/<id>/ — حذف الطالب نهائياً (للمشرفين فقط)
    """

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsAdmin()]
        return [IsAdminOrTeacherOrSelf()]

    def get(self, request, student_id):
        student = student_get(student_id=student_id, actor=request.user)
        return Response(
            {"success": True, "data": StudentOutputSerializer(student).data},
            status=status.HTTP_200_OK,
        )

    def patch(self, request, student_id):
        student = student_get(student_id=student_id, actor=request.user)
        serializer = StudentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = student_update(
            student=student,
            actor=request.user,
            data=serializer.validated_data,
        )

        return Response(
            {"success": True, "data": StudentOutputSerializer(updated).data},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, student_id):
        """DELETE /api/students/<id>/ — حذف نهائي"""
        student_delete(student_id=student_id, actor=request.user)
        return Response(
            {"success": True, "message": "تم حذف الطالب نهائياً بنجاح."},
            status=status.HTTP_200_OK,
        )


class StudentHistoryApi(APIView):
    """GET /api/students/<id>/history/ — السجل الحفظي الكامل"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request, student_id):
        history = student_history(student_id=student_id, actor=request.user)
        return Response(
            {"success": True, "data": history},
            status=status.HTTP_200_OK,
        )


class StudentStatsApi(APIView):
    """GET /api/students/<id>/stats/ — إحصائيات الطالب"""

    permission_classes = [IsAdminOrTeacherOrSelf]

    def get(self, request, student_id):
        stats = student_stats(student_id=student_id, actor=request.user)
        return Response(
            {"success": True, "data": stats},
            status=status.HTTP_200_OK,
        )


class StudentAssignTeacherApi(APIView):
    """PATCH /api/students/<id>/assign-teacher/ — تعيين محفظ"""

    permission_classes = [IsAdmin]

    def patch(self, request, student_id):
        serializer = AssignTeacherSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student = student_assign_teacher(
            student_id=student_id,
            teacher_id=serializer.validated_data["teacher_id"],
            actor=request.user,
        )

        return Response(
            {"success": True, "data": StudentOutputSerializer(student).data},
            status=status.HTTP_200_OK,
        )


class StudentLinkParentApi(APIView):
    """POST /api/students/<id>/link-parent/ — ربط ولي الأمر"""

    permission_classes = [IsAdmin]

    def post(self, request, student_id):
        serializer = LinkParentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student_link_parent(
            student_id=student_id,
            parent_id=serializer.validated_data["parent_id"],
            actor=request.user,
        )

        return Response(
            {"success": True, "message": "تم ربط ولي الأمر بالطالب بنجاح."},
            status=status.HTTP_201_CREATED,
        )
