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
            "expected_at", "otp_code", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "otp_code", "status", "created_at", "updated_at"]

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name()

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        company = attrs.get("company", getattr(instance, "company", None))
        employee = attrs.get("employee", getattr(instance, "employee", None))

        if company and employee and employee.company_id != company.id:
            raise serializers.ValidationError({
                "employee": "Selected employee must belong to the selected company."
            })

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return attrs

        user = request.user
        if user.role == "company":
            if not company or not get_administered_companies(user).filter(id=company.id).exists():
                raise serializers.ValidationError({
                    "company": "You can only manage deliveries for your own company."
                })
        elif user.role == "employee":
            employee_profile = get_employee_profile(user)
            if employee_profile is None:
                raise serializers.ValidationError("Employee profile not found.")
            if company and company.id != employee_profile.company_id:
                raise serializers.ValidationError({
                    "company": "You can only manage deliveries for your own company."
                })
            if employee and employee.id != employee_profile.id:
                raise serializers.ValidationError({
                    "employee": "Employees can only manage their own deliveries."
                })

        return attrs


class DeliveryGateSerializer(serializers.ModelSerializer):
    """Serializer for guard view - hides OTP."""
    company_name = serializers.CharField(source="company.name", read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = Delivery
        fields = [
            "id", "company_name", "employee_name",
            "delivery_type", "status", "platform_name", "order_id",
            "delivery_person_name", "delivery_person_phone",
            "expected_at", "notes", "created_at",
        ]

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name()


class VerifyOTPSerializer(serializers.Serializer):
    otp = serializers.CharField(max_length=6, min_length=6)
