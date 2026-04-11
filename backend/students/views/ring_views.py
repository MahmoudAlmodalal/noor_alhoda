from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from django.db.models import Q, Count

from core.permissions import IsAdmin
from students.models import Ring, Teacher

# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
class RingOutputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    status = serializers.CharField()
    level = serializers.CharField(allow_blank=True)
    teacher_id = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()
    students_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()

    def get_teacher_id(self, obj):
        return str(obj.teacher.id) if obj.teacher else None

    def get_teacher_name(self, obj):
        return obj.teacher.full_name if obj.teacher else None

class RingInputSerializer(serializers.Serializer):
    name = serializers.CharField()
    teacher_id = serializers.UUIDField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=Ring.Status.choices, default=Ring.Status.ACTIVE)
    level = serializers.CharField(required=False, allow_blank=True, default="")

# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------
class RingListApi(APIView):
    """GET /api/rings/ — قائمة الحلقات"""
    permission_classes = [IsAdmin]

    def get(self, request):
        search = request.query_params.get("search", "")
        rings = Ring.objects.annotate(students_count=Count("students")).all()
        
        if search:
            rings = rings.filter(
                Q(name__icontains=search) | 
                Q(teacher__full_name__icontains=search)
            )

        return Response(
            {"success": True, "data": RingOutputSerializer(rings, many=True).data},
            status=status.HTTP_200_OK,
        )

class RingCreateApi(APIView):
    """POST /api/rings/create/ — إنشاء حلقة جديدة"""
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = RingInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        teacher_id = data.pop("teacher_id", None)
        
        if teacher_id:
            try:
                data["teacher"] = Teacher.objects.get(id=teacher_id)
            except Teacher.DoesNotExist:
                raise serializers.ValidationError({"teacher_id": "المحفظ غير موجود."})
        
        ring = Ring.objects.create(**data)
        
        # Refetch to get annotated count
        ring = Ring.objects.annotate(students_count=Count("students")).get(id=ring.id)
        
        return Response(
            {"success": True, "data": RingOutputSerializer(ring).data},
            status=status.HTTP_201_CREATED,
        )

class RingDetailApi(APIView):
    """
    GET /api/rings/<id>/ — تفاصيل الحلقة
    PATCH /api/rings/<id>/ — تعديل الحلقة
    DELETE /api/rings/<id>/ — حذف الحلقة
    """
    permission_classes = [IsAdmin]

    def get(self, request, ring_id):
        try:
            ring = Ring.objects.annotate(students_count=Count("students")).get(id=ring_id)
        except Ring.DoesNotExist:
            return Response({"success": False, "message": "الحلقة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)
            
        return Response(
            {"success": True, "data": RingOutputSerializer(ring).data},
            status=status.HTTP_200_OK,
        )

    def patch(self, request, ring_id):
        try:
            ring = Ring.objects.get(id=ring_id)
        except Ring.DoesNotExist:
            return Response({"success": False, "message": "الحلقة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)
            
        serializer = RingInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        teacher_id = data.pop("teacher_id", "no_change")
        
        if teacher_id != "no_change":
            if teacher_id is None:
                ring.teacher = None
            else:
                try:
                    ring.teacher = Teacher.objects.get(id=teacher_id)
                except Teacher.DoesNotExist:
                    raise serializers.ValidationError({"teacher_id": "المحفظ غير موجود."})
        
        for attr, value in data.items():
            setattr(ring, attr, value)
            
        ring.save()
        
        # Refetch to get annotated count
        ring = Ring.objects.annotate(students_count=Count("students")).get(id=ring.id)
        
        return Response(
            {"success": True, "data": RingOutputSerializer(ring).data},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, ring_id):
        try:
            ring = Ring.objects.get(id=ring_id)
        except Ring.DoesNotExist:
            return Response({"success": False, "message": "الحلقة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)
            
        ring.delete()
        return Response(
            {"success": True, "message": "تم حذف الحلقة بنجاح."},
            status=status.HTTP_200_OK,
        )

class TeacherAssignRingApi(APIView):
    """PATCH /api/users/teachers/<id>/assign-ring/ — تعيين حلقة للمحفظ"""
    permission_classes = [IsAdmin]

    def patch(self, request, teacher_id):
        try:
            teacher = Teacher.objects.get(id=teacher_id)
        except Teacher.DoesNotExist:
            return Response({"success": False, "message": "المحفظ غير موجود."}, status=status.HTTP_404_NOT_FOUND)
            
        ring_id = request.data.get("ring_id")
        if not ring_id:
            return Response({"success": False, "message": "يجب تحديد الحلقة."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            ring = Ring.objects.get(id=ring_id)
        except Ring.DoesNotExist:
            return Response({"success": False, "message": "الحلقة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)
            
        ring.teacher = teacher
        ring.save()
        
        return Response(
            {"success": True, "message": "تم تعيين الحلقة بنجاح."},
            status=status.HTTP_200_OK,
        )
