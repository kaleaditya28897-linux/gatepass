from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.accounts.serializers import run_password_validators, validate_new_username
from apps.companies.utils import get_administered_companies
from .models import Company, Employee

User = get_user_model()


def ensure_company_has_capacity(company, adding=1):
    current = company.employees.count()
    if current + adding > company.max_employees:
        raise serializers.ValidationError(
            f"{company.name} has reached its limit of {company.max_employees} employees."
        )


class CompanySerializer(serializers.ModelSerializer):
    admin_name = serializers.SerializerMethodField()
    admin_username = serializers.CharField(source="admin.username", read_only=True, default=None)
    employee_count = serializers.SerializerMethodField()
    # Optional: create the company admin login together with the company.
    admin_account = serializers.DictField(write_only=True, required=False)

    class Meta:
        model = Company
        fields = [
            "id", "name", "slug", "admin", "admin_name", "admin_username", "admin_account",
            "floor", "suite_number", "phone", "email", "logo", "max_employees", "is_active",
            "employee_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_admin_name(self, obj):
        if obj.admin is None:
            return None
        return obj.admin.get_full_name() or obj.admin.username

    def get_employee_count(self, obj):
        return obj.employees.count()

    def validate_admin(self, user):
        if user is None:
            return user
        if user.role != User.Role.COMPANY:
            raise serializers.ValidationError("The company admin must be a user with the company admin role.")
        other = Company.objects.filter(admin=user)
        if self.instance is not None:
            other = other.exclude(pk=self.instance.pk)
        if other.exists():
            raise serializers.ValidationError("This user already administers another company.")
        return user

    def validate_admin_account(self, value):
        from apps.accounts.serializers import UserSerializer

        if not value:
            return None
        if self.instance is not None and self.instance.admin_id:
            raise serializers.ValidationError("This company already has an admin account.")
        data = {**value, "role": User.Role.COMPANY}
        account = UserSerializer(data=data)
        if not account.is_valid():
            raise serializers.ValidationError(account.errors)
        return account.validated_data

    def validate(self, attrs):
        if attrs.get("admin") and attrs.get("admin_account"):
            raise serializers.ValidationError(
                {"admin_account": "Choose an existing admin or create a new one, not both."}
            )
        return attrs

    def _create_admin(self, account):
        password = account.pop("password")
        user = User(**account)
        user.set_password(password)
        user.save()
        return user

    @transaction.atomic
    def create(self, validated_data):
        account = validated_data.pop("admin_account", None)
        if account:
            validated_data["admin"] = self._create_admin(account)
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        account = validated_data.pop("admin_account", None)
        if account:
            validated_data["admin"] = self._create_admin(account)
        return super().update(instance, validated_data)


class CompanyDirectorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name", "floor", "suite_number"]


class EmployeeDirectorySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = ["id", "name", "company", "designation", "department"]

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class EmployeeSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", required=False, allow_blank=True)
    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)
    phone = serializers.CharField(source="user.phone", required=False, allow_blank=True, max_length=20)
    is_active = serializers.BooleanField(source="user.is_active", required=False)
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id", "user", "username", "email", "first_name", "last_name",
            "phone", "is_active", "company", "company_name", "employee_id", "designation",
            "department", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "user", "company", "created_at", "updated_at"]

    def validate_employee_id(self, value):
        if value and self.instance is not None:
            clash = Employee.objects.filter(company=self.instance.company, employee_id=value)
            if clash.exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError("This employee ID is already used in this company.")
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        if user_data:
            for field, value in user_data.items():
                setattr(instance.user, field, value)
            instance.user.save(update_fields=list(user_data.keys()))
        return super().update(instance, validated_data)


class EmployeeCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(required=False, allow_blank=True, default="", max_length=20)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), required=False)
    employee_id = serializers.CharField(required=False, allow_blank=True, default="", max_length=50)
    designation = serializers.CharField(required=False, allow_blank=True, default="", max_length=100)
    department = serializers.CharField(required=False, allow_blank=True, default="", max_length=100)

    def validate_username(self, value):
        return validate_new_username(value)

    def validate_password(self, value):
        return run_password_validators(value)

    def validate(self, attrs):
        request = self.context.get("request")
        company = attrs.get("company")
        if request and request.user.role == "company":
            owned = get_administered_companies(request.user)
            if company is None:
                company = owned.first()
                if company is None:
                    raise serializers.ValidationError("Your account is not linked to a company.")
                attrs["company"] = company
            elif not owned.filter(id=company.id).exists():
                raise serializers.ValidationError(
                    {"company": "You can only create employees for your own company."}
                )
        if company is None:
            raise serializers.ValidationError({"company": "This field is required."})
        ensure_company_has_capacity(company)
        employee_id = attrs.get("employee_id")
        if employee_id and Employee.objects.filter(company=company, employee_id=employee_id).exists():
            raise serializers.ValidationError(
                {"employee_id": "This employee ID is already used in this company."}
            )
        return attrs

    @transaction.atomic
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
        return Employee.objects.create(
            user=user,
            company=validated_data["company"],
            employee_id=validated_data.get("employee_id", ""),
            designation=validated_data.get("designation", ""),
            department=validated_data.get("department", ""),
        )

    def to_representation(self, instance):
        return EmployeeSerializer(instance, context=self.context).data


class BulkEmployeeUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), required=False)

    MAX_FILE_SIZE = 2 * 1024 * 1024

    def validate_file(self, file):
        if file.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError("The CSV file must be smaller than 2 MB.")
        return file

    def validate(self, attrs):
        request = self.context.get("request")
        company = attrs.get("company")
        if request and request.user.role == "company":
            owned = get_administered_companies(request.user)
            if company is None:
                company = owned.first()
                attrs["company"] = company
            elif not owned.filter(id=company.id).exists():
                raise serializers.ValidationError(
                    {"company": "You can only bulk upload employees for your own company."}
                )
        if company is None:
            raise serializers.ValidationError({"company": "This field is required."})
        return attrs
