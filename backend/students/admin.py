from django.contrib import admin

from .models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("full_name", "user_national_id", "grade", "teacher")
    list_filter = ("grade", "health_status", "teacher")
    search_fields = ("full_name", "user__national_id")

    @admin.display(description="رقم الهوية", ordering="user__national_id")
    def user_national_id(self, obj):
        return obj.user.national_id
    readonly_fields = ("enrollment_date", "created_at", "updated_at")
