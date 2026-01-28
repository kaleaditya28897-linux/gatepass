from django.db import models
from django.conf import settings
from apps.core.models import TimestampedModel


class Company(TimestampedModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="administered_companies"
    )
    floor = models.CharField(max_length=50, blank=True)
    suite_number = models.CharField(max_length=50, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    logo = models.ImageField(upload_to="company_logos/", blank=True, null=True)
    max_employees = models.PositiveIntegerField(default=50)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "companies"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Employee(TimestampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="employee_profile"
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="employees")
    employee_id = models.CharField(max_length=50, blank=True)
    designation = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=100, blank=True)

    class Meta:
        unique_together = ["company", "employee_id"]

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.company.name}"
