from django.contrib import admin
from .models import Notification, DirectMessage


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "recipient", "type", "is_read", "created_at")
    list_filter = ("type", "is_read")
    search_fields = ("title", "body", "recipient__phone_number")


@admin.register(DirectMessage)
class DirectMessageAdmin(admin.ModelAdmin):
    list_display = ("sender", "student", "sender_role", "is_read", "created_at")
    list_filter = ("sender_role", "is_read")
    search_fields = ("body", "sender__national_id", "student__full_name")
    readonly_fields = ("id", "created_at")
