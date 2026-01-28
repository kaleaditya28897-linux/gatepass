from django.contrib import admin
from .models import Delivery


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = [
        "id", "company", "employee", "delivery_type", "status",
        "platform_name", "expected_at", "created_at",
    ]
    list_filter = ["status", "delivery_type", "company"]
    search_fields = ["platform_name", "order_id", "delivery_person_name"]
