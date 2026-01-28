from django.db import models
from django.conf import settings
from apps.core.models import TimestampedModel


class EntryLog(TimestampedModel):
    class EntryType(models.TextChoices):
        VISITOR = "visitor", "Visitor"
        DELIVERY = "delivery", "Delivery"

    visitor_pass = models.ForeignKey(
        "passes.VisitorPass", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="entry_logs"
    )
    delivery = models.ForeignKey(
        "deliveries.Delivery", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="entry_logs"
    )
    entry_type = models.CharField(max_length=20, choices=EntryType.choices, default=EntryType.VISITOR)
    gate = models.ForeignKey("gates.Gate", on_delete=models.SET_NULL, null=True, related_name="entry_logs")
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name="checkins_performed"
    )
    checked_out_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="checkouts_performed"
    )
    check_in_time = models.DateTimeField(auto_now_add=True)
    check_out_time = models.DateTimeField(null=True, blank=True)

    # Denormalized fields
    visitor_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    company_name = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-check_in_time"]

    def __str__(self):
        return f"Entry: {self.visitor_name} at {self.gate} ({self.check_in_time})"
