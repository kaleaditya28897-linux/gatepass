from rest_framework import serializers
from .models import VisitorPass


class VisitorPassSerializer(serializers.ModelSerializer):
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
            "pass_type", "status", "valid_from", "valid_until",
        ]

    def get_host_employee_name(self, obj):
        if obj.host_employee:
            return obj.host_employee.user.get_full_name()
        return None


class WalkInPassSerializer(serializers.ModelSerializer):
    class Meta:
        model = VisitorPass
        fields = [
            "visitor_name", "visitor_phone", "visitor_email", "visitor_company",
            "id_type", "id_number", "photo", "vehicle_number", "purpose",
            "host_company", "host_employee", "valid_from", "valid_until",
        ]
