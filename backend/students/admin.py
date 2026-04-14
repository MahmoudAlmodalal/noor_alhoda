from django.contrib import admin

from .models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("full_name", "national_id", "grade", "teacher", "get_is_active")
    list_filter = ("grade", "health_status", "teacher")
    search_fields = ("full_name", "national_id")
    readonly_fields = ("enrollment_date", "created_at", "updated_at")

    @admin.display(boolean=True, description="الحالة (نشط)")
    def get_is_active(self, obj):
        return obj.user.is_active
