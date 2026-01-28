from django.db import models
from django.conf import settings
from apps.core.models import TimestampedModel


class Gate(TimestampedModel):
    class GateType(models.TextChoices):
        PEDESTRIAN = "pedestrian", "Pedestrian"
        VEHICLE = "vehicle", "Vehicle"
        SERVICE = "service", "Service"

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    location = models.CharField(max_length=255, blank=True)
    gate_type = models.CharField(max_length=20, choices=GateType.choices, default=GateType.PEDESTRIAN)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class GuardProfile(TimestampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="guard_profile"
    )
    badge_number = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Guard: {self.user.get_full_name()} ({self.badge_number})"


class GuardShift(TimestampedModel):
    guard = models.ForeignKey(GuardProfile, on_delete=models.CASCADE, related_name="shifts")
    gate = models.ForeignKey(Gate, on_delete=models.CASCADE, related_name="shifts")
    shift_start = models.DateTimeField()
    shift_end = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-shift_start"]

    def __str__(self):
        return f"{self.guard} at {self.gate} ({self.shift_start} - {self.shift_end})"
