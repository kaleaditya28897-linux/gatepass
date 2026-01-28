from django.contrib import admin
from .models import VisitorPass


@admin.register(VisitorPass)
class VisitorPassAdmin(admin.ModelAdmin):
    list_display = [
        "pass_code", "visitor_name", "host_company", "pass_type",
        "status", "valid_from", "valid_until", "created_at",
    ]
    list_filter = ["status", "pass_type", "host_company"]
    search_fields = ["visitor_name", "visitor_phone", "pass_code"]
    readonly_fields = ["pass_code", "qr_code_image"]
