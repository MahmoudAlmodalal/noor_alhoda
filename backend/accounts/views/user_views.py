from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

from core.permissions import IsAdmin, IsAdminOrTeacher
from accounts.selectors.user_selectors import user_list, user_get, teacher_list
from accounts.services.user_services import (
    user_create,
    user_update,
    user_delete,
    teacher_create,
)


# ---------------------------------------------------------------------------
# Serializers (inline)
# ---------------------------------------------------------------------------
class UserFilterSerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=["admin", "teacher", "student", "parent"],
        required=False,
    )
    is_active = serializers.BooleanField(required=False)
    search = serializers.CharField(required=False)


class UserInputSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    username = serializers.CharField(required=False)
    first_name = serializers.CharField(required=False, default="")
    last_name = serializers.CharField(required=False, default="")
    role = serializers.ChoiceField(
        choices=["admin", "teacher", "student", "parent"],
        default="student",
    )
    password = serializers.CharField(required=False, default="nooralhuda2026")


class UserOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    phone_number = serializers.CharField()
    username = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    role = serializers.CharField()
    is_active = serializers.BooleanField()
    date_joined = serializers.DateTimeField()


class UserUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False)
    last_name = serializers.CharField(required=False)
    phone_number = serializers.CharField(required=False)
    role = serializers.CharField(required=False)
    is_active = serializers.BooleanField(required=False)
    fcm_token = serializers.CharField(required=False)
    password = serializers.CharField(required=False)
    specialization = serializers.CharField(required=False)


class TeacherInputSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    username = serializers.CharField(required=False)
    first_name = serializers.CharField(required=False, default="")
    last_name = serializers.CharField(required=False, default="")
    password = serializers.CharField(required=False, default="nooralhuda2026")
    full_name = serializers.CharField()
    specialization = serializers.CharField(required=False, default="")
    session_days = serializers.ListField(child=serializers.CharField(), required=False, default=[])
    max_students = serializers.IntegerField(required=False, default=25)


class TeacherOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    user_id = serializers.UUIDField(source="user.id")
    full_name = serializers.CharField()
    specialization = serializers.CharField()
    session_days = serializers.JSONField()
    max_students = serializers.IntegerField()
    created_at = serializers.DateTimeField()


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class UserListApi(APIView):
    """GET /api/users/ — قائمة المستخدمين (مدير فقط)"""

    permission_classes = [IsAdmin]

    def get(self, request):
        filter_serializer = UserFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)

        users = user_list(filters=filter_serializer.validated_data, actor=request.user)

        return Response(
            {"success": True, "data": UserOutputSerializer(users, many=True).data},
            status=status.HTTP_200_OK,
        )


class UserCreateApi(APIView):
    """POST /api/users/ — إنشاء مستخدم جديد (مدير فقط)"""

    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = UserInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = user_create(creator=request.user, **serializer.validated_data)

        return Response(
            {"success": True, "data": UserOutputSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class UserDetailApi(APIView):
    """
    GET /api/users/<id>/ — تفاصيل مستخدم
    PATCH /api/users/<id>/ — تعديل مستخدم
    DELETE /api/users/<id>/ — تعطيل مستخدم (soft delete)
    """

    permission_classes = [IsAdmin]

    def get(self, request, user_id):
        user = user_get(user_id=user_id, actor=request.user)
        return Response(
            {"success": True, "data": UserOutputSerializer(user).data},
            status=status.HTTP_200_OK,
        )

    def patch(self, request, user_id):
        user = user_get(user_id=user_id, actor=request.user)
        serializer = UserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_user = user_update(
            user=user,
            actor=request.user,
            data=serializer.validated_data,
        )

        return Response(
            {"success": True, "data": UserOutputSerializer(updated_user).data},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, user_id):
        user = user_get(user_id=user_id, actor=request.user)
        user_delete(user=user, actor=request.user)

        return Response(
            {"success": True, "message": "تم حذف الحساب بنجاح."},
            status=status.HTTP_200_OK,
        )


class TeacherListApi(APIView):
    """GET /api/users/teachers/ — قائمة المحفظين"""

    permission_classes = [IsAdminOrTeacher]

    def get(self, request):
        filter_serializer = UserFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)

        teachers = teacher_list(filters=filter_serializer.validated_data)

        return Response(
            {"success": True, "data": TeacherOutputSerializer(teachers, many=True).data},
            status=status.HTTP_200_OK,
        )


class TeacherCreateApi(APIView):
    """POST /api/users/teachers/ — إنشاء محفظ جديد (مدير فقط)"""

    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = TeacherInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        teacher = teacher_create(creator=request.user, **serializer.validated_data)

        return Response(
            {"success": True, "data": TeacherOutputSerializer(teacher).data},
            status=status.HTTP_201_CREATED,
        )
