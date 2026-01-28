from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        COMPANY = "company", "Company Admin"
        EMPLOYEE = "employee", "Employee"
        GUARD = "guard", "Guard"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.EMPLOYEE)
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_company_admin(self):
        return self.role == self.Role.COMPANY

    @property
    def is_employee(self):
        return self.role == self.Role.EMPLOYEE

    @property
    def is_guard(self):
        return self.role == self.Role.GUARD
