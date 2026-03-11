from rest_framework import serializers
from apps.companies.utils import get_administered_companies, get_employee_profile
from .models import VisitorPass


class VisitorPassValidationMixin:
    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        host_company = attrs.get("host_company", getattr(instance, "host_company", None))
        host_employee = attrs.get("host_employee", getattr(instance, "host_employee", None))

        if host_employee and host_company and host_employee.company_id != host_company.id:
            raise serializers.ValidationError({
                "host_employee": "Selected host employee must belong to the selected company."
            })

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return attrs

        user = request.user
        if user.role == "company":
            if not host_company or not get_administered_companies(user).filter(id=host_company.id).exists():
                raise serializers.ValidationError({
                    "host_company": "You can only manage passes for your own company."
                })
        elif user.role == "employee":
            employee_profile = get_employee_profile(user)
            if employee_profile is None:
                raise serializers.ValidationError("Employee profile not found.")
            if host_company and host_company.id != employee_profile.company_id:
                raise serializers.ValidationError({
                    "host_company": "You can only manage passes for your own company."
                })
            if host_employee and host_employee.id != employee_profile.id:
                raise serializers.ValidationError({
                    "host_employee": "Employees can only create passes for themselves."
                })

        return attrs


class VisitorPassSerializer(VisitorPassValidationMixin, serializers.ModelSerializer):
    host_company_name = serializers.CharField(source="host_company.name", read_only=True)
    host_employee_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    pass_url = serializers.SerializerMethodField()

    class Meta:
        model = VisitorPass
        fields = [
            "id", "visitor_name", "visitor_phone", "visitor_email", "visitor_company",
            "id_type", "id_number", "photo", "vehicle_number", "purpose",
            "host_company", "host_company_name", "host_employee", "host_employee_name",
            "pass_code", "qr_code_image", "pass_type", "status",
            "valid_from", "valid_until",
            "created_by", "created_by_name", "approved_by", "approved_by_name",
            "approved_at", "rejected_reason",
            "pass_url", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "pass_code", "qr_code_image", "status", "created_by",
            "approved_by", "approved_at", "created_at", "updated_at",
        ]

    def get_host_employee_name(self, obj):
        if obj.host_employee:
            return obj.host_employee.user.get_full_name()
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name()
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name()
        return None

    def get_pass_url(self, obj):
        from django.conf import settings
        return f"{settings.FRONTEND_URL}/pass/{obj.pass_code}"


class VisitorPassVerifySerializer(serializers.ModelSerializer):
    host_company_name = serializers.CharField(source="host_company.name", read_only=True)
    host_employee_name = serializers.SerializerMethodField()

    class Meta:
        model = VisitorPass
        fields = [
            "id", "visitor_name", "visitor_phone", "visitor_company",
            "id_type", "id_number", "photo", "vehicle_number", "purpose",
            "host_company_name", "host_employee_name",
            "qr_code_image", "pass_type", "status", "valid_from", "valid_until",
        ]

    def get_host_employee_name(self, obj):
        if obj.host_employee:
            return obj.host_employee.user.get_full_name()
        return None


class WalkInPassSerializer(VisitorPassValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = VisitorPass
        fields = [
            "visitor_name", "visitor_phone", "visitor_email", "visitor_company",
            "id_type", "id_number", "photo", "vehicle_number", "purpose",
            "host_company", "host_employee", "valid_from", "valid_until",
        ]
