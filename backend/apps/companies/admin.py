from django.contrib import admin
from .models import Company, Employee


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["name", "admin", "floor", "suite_number", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "email"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ["user", "company", "employee_id", "designation", "department"]
    list_filter = ["company", "department"]
    search_fields = ["user__first_name", "user__last_name", "employee_id"]
