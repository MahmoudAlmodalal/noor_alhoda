from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, Teacher, Parent, ParentStudentLink, OTPCode


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("phone_number", "first_name", "last_name", "role")
    list_filter = ("role",)
    search_fields = ("phone_number", "first_name", "last_name")
    ordering = ("-date_joined",)
    fieldsets = (
        (None, {"fields": ("phone_number", "password")}),
        ("المعلومات الشخصية", {"fields": ("first_name", "last_name", "email")}),
        (
            "الصلاحيات",
            {
                "fields": (
                    "role",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("معلومات إضافية", {"fields": ("fcm_token",)}),
        ("تواريخ مهمة", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "phone_number",
                    "first_name",
                    "last_name",
                    "role",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
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
