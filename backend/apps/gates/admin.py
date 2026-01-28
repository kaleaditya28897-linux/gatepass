from django.contrib import admin
from .models import Gate, GuardProfile, GuardShift


@admin.register(Gate)
class GateAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "gate_type", "is_active"]
    list_filter = ["gate_type", "is_active"]


@admin.register(GuardProfile)
class GuardProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "badge_number", "is_active"]
    list_filter = ["is_active"]


@admin.register(GuardShift)
class GuardShiftAdmin(admin.ModelAdmin):
    list_display = ["guard", "gate", "shift_start", "shift_end", "is_active"]
    list_filter = ["gate", "is_active"]
