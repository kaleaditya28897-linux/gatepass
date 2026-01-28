from rest_framework import serializers
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
