from rest_framework import serializers

from apps.companies.utils import get_administered_companies, get_employee_profile
from .models import Delivery


class DeliverySerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = Delivery
        fields = [
            "id", "company", "company_name", "employee", "employee_name",
            "delivery_type", "status", "platform_name", "order_id",
            "delivery_person_name", "delivery_person_phone",
            "expected_at", "otp_code", "otp_attempts", "delivered_at", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "otp_code", "otp_attempts", "delivered_at", "status", "created_at", "updated_at",
        ]
        extra_kwargs = {"company": {"required": False}}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if getattr(getattr(request, "user", None), "role", None) == "employee":
            # Employees always register deliveries for themselves.
            self.fields["employee"].required = False

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name() or obj.employee.user.username

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        role = getattr(user, "role", None)

        if role == "employee":
            employee_profile = get_employee_profile(user)
            if employee_profile is None:
                raise serializers.ValidationError("Employee profile not found.")
            company = attrs.get("company")
            employee = attrs.get("employee")
            if company and company.id != employee_profile.company_id:
                raise serializers.ValidationError({
                    "company": "You can only manage deliveries for your own company."
                })
            if employee and employee.id != employee_profile.id:
                raise serializers.ValidationError({
                    "employee": "Employees can only manage their own deliveries."
                })
            attrs["company"] = employee_profile.company
            attrs["employee"] = employee_profile

        employee = attrs.get("employee", getattr(instance, "employee", None))
        company = attrs.get("company", getattr(instance, "company", None))
        if company is None and employee is not None:
            company = employee.company
            attrs["company"] = company
        if company is None:
            raise serializers.ValidationError({"company": "This field is required."})
        if employee is not None and employee.company_id != company.id:
            raise serializers.ValidationError({
                "employee": "Selected employee must belong to the selected company."
            })
        if role == "company" and not get_administered_companies(user).filter(id=company.id).exists():
            raise serializers.ValidationError({
                "company": "You can only manage deliveries for your own company."
            })
        if instance is None and not company.is_active:
            raise serializers.ValidationError({"company": "This company is not active."})
        return attrs


class DeliveryGateSerializer(serializers.ModelSerializer):
    """Serializer for guard view - hides OTP."""
    company_name = serializers.CharField(source="company.name", read_only=True)
    company_floor = serializers.CharField(source="company.floor", read_only=True)
    employee_name = serializers.SerializerMethodField()
    otp_locked = serializers.SerializerMethodField()

    class Meta:
        model = Delivery
        fields = [
            "id", "company_name", "company_floor", "employee_name",
            "delivery_type", "status", "platform_name", "order_id",
            "delivery_person_name", "delivery_person_phone",
            "expected_at", "notes", "otp_locked", "created_at",
        ]

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name() or obj.employee.user.username

    def get_otp_locked(self, obj):
        from django.conf import settings
        return obj.otp_attempts >= settings.DELIVERY_OTP_MAX_ATTEMPTS


class ArrivedSerializer(serializers.Serializer):
    gate = serializers.IntegerField(required=False)
    delivery_person_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    delivery_person_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)


class VerifyOTPSerializer(serializers.Serializer):
    otp = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Enter the 6-digit code."})
