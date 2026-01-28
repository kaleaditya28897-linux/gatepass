from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["id", "channel", "recipient_phone", "recipient_email", "status", "sent_at"]
    list_filter = ["channel", "status"]
    search_fields = ["recipient_phone", "recipient_email"]
