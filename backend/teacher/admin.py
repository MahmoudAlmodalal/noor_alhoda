from django.contrib import admin

from teacher.models import Teacher


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ("full_name", "specialization", "max_students")
    search_fields = ("full_name",)
