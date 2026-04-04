from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, Teacher, Parent, ParentStudentLink, OTPCode


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("phone_number", "username", "first_name", "last_name", "role", "is_active")
    list_filter = ("role", "is_active")
    search_fields = ("phone_number", "username", "first_name", "last_name")
    ordering = ("-date_joined",)
    fieldsets = BaseUserAdmin.fieldsets + (
        ("معلومات إضافية", {"fields": ("phone_number", "role", "fcm_token")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("معلومات إضافية", {"fields": ("phone_number", "role")}),
    )


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ("full_name", "specialization", "max_students")
    search_fields = ("full_name",)


@admin.register(Parent)
class ParentAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone_number")
    search_fields = ("full_name",)


@admin.register(ParentStudentLink)
class ParentStudentLinkAdmin(admin.ModelAdmin):
    list_display = ("parent", "student")


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "is_used", "expires_at", "created_at")
    list_filter = ("is_used",)
