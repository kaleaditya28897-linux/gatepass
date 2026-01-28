from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Company, Employee

User = get_user_model()


class CompanySerializer(serializers.ModelSerializer):
    admin_name = serializers.CharField(source="admin.get_full_name", read_only=True)
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id", "name", "slug", "admin", "admin_name", "floor", "suite_number",
            "phone", "email", "logo", "max_employees", "is_active",
            "employee_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_employee_count(self, obj):
        return obj.employees.count()


class EmployeeSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id", "user", "username", "email", "first_name", "last_name",
            "phone", "company", "company_name", "employee_id", "designation",
            "department", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EmployeeCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone = serializers.CharField(required=False, default="")
    password = serializers.CharField(write_only=True, min_length=8)
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all())
    employee_id = serializers.CharField(required=False, default="")
    designation = serializers.CharField(required=False, default="")
    department = serializers.CharField(required=False, default="")

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            phone=validated_data.get("phone", ""),
            password=validated_data["password"],
            role="employee",
        )
        employee = Employee.objects.create(
            user=user,
            company=validated_data["company"],
            employee_id=validated_data.get("employee_id", ""),
            designation=validated_data.get("designation", ""),
            department=validated_data.get("department", ""),
        )
        return employee


class BulkEmployeeUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all())
