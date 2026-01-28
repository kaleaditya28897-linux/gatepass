from django.contrib import admin
from .models import EntryLog


@admin.register(EntryLog)
class EntryLogAdmin(admin.ModelAdmin):
    list_display = ["visitor_name", "entry_type", "gate", "check_in_time", "check_out_time"]
    list_filter = ["entry_type", "gate"]
    search_fields = ["visitor_name", "phone"]
