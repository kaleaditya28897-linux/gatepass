import random
from django.db import models
from django.conf import settings
from apps.core.models import TimestampedModel


class Delivery(TimestampedModel):
    class DeliveryType(models.TextChoices):
        FOOD_ORDER = "food_order", "Food Order"
        COURIER = "courier", "Courier"
        DOCUMENT = "document", "Document"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        EXPECTED = "expected", "Expected"
        ARRIVED = "arrived", "Arrived"
        DELIVERED = "delivered", "Delivered"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE, related_name="deliveries"
    )
    employee = models.ForeignKey(
        "companies.Employee", on_delete=models.CASCADE, related_name="deliveries"
    )
    delivery_type = models.CharField(max_length=20, choices=DeliveryType.choices, default=DeliveryType.FOOD_ORDER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EXPECTED)
    platform_name = models.CharField(max_length=100, blank=True, help_text="e.g. Swiggy, Zomato, Amazon")
    order_id = models.CharField(max_length=100, blank=True)
    delivery_person_name = models.CharField(max_length=255, blank=True)
    delivery_person_phone = models.CharField(max_length=20, blank=True)
    expected_at = models.DateTimeField(null=True, blank=True)
    otp_code = models.CharField(max_length=6, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "deliveries"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Delivery {self.id} - {self.delivery_type} for {self.employee}"

    def save(self, *args, **kwargs):
        if not self.otp_code:
            self.otp_code = str(random.randint(100000, 999999))
        super().save(*args, **kwargs)
