import uuid
from django.db import models
from django.conf import settings
from apps.core.models import TimestampedModel


class VisitorPass(TimestampedModel):
    class PassType(models.TextChoices):
        PRE_APPROVED = "pre_approved", "Pre-Approved"
        WALK_IN = "walk_in", "Walk-In"
        RECURRING = "recurring", "Recurring"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        CHECKED_IN = "checked_in", "Checked In"
        CHECKED_OUT = "checked_out", "Checked Out"
        EXPIRED = "expired", "Expired"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    # Visitor info
    visitor_name = models.CharField(max_length=255)
    visitor_phone = models.CharField(max_length=20)
    visitor_email = models.EmailField(blank=True)
    visitor_company = models.CharField(max_length=255, blank=True)
    id_type = models.CharField(max_length=50, blank=True)
    id_number = models.CharField(max_length=100, blank=True)
    photo = models.ImageField(upload_to="visitor_photos/", blank=True, null=True)
    vehicle_number = models.CharField(max_length=20, blank=True)
    purpose = models.TextField(blank=True)

    # Host
    host_company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE, related_name="visitor_passes"
    )
    host_employee = models.ForeignKey(
        "companies.Employee", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="visitor_passes"
    )

    # Pass
    pass_code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    qr_code_image = models.ImageField(upload_to="qr_codes/", blank=True, null=True)
    pass_type = models.CharField(max_length=20, choices=PassType.choices, default=PassType.PRE_APPROVED)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    # Validity
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()

    # Workflow
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name="created_passes"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="approved_passes"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Pass {self.pass_code} - {self.visitor_name} -> {self.host_company}"
