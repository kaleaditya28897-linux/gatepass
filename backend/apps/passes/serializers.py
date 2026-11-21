from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from apps.companies.utils import get_administered_companies, get_employee_profile
from .models import VisitorPass


class VisitorPassValidationMixin:
    """Shared host/validity rules for regular and walk-in passes."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", None)
        # Employees and company admins always host inside their own company,
        # so the client does not have to send it.
        if role in ("employee", "company") and "host_company" in self.fields:
            self.fields["host_company"].required = False

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        role = getattr(user, "role", None)

        if role == "employee":
            employee_profile = get_employee_profile(user)
            if employee_profile is None:
                raise serializers.ValidationError("Employee profile not found.")
            host_company = attrs.get("host_company")
            host_employee = attrs.get("host_employee")
            if host_company and host_company.id != employee_profile.company_id:
                raise serializers.ValidationError({
                    "host_company": "You can only manage passes for your own company."
                })
            if host_employee and host_employee.id != employee_profile.id:
                raise serializers.ValidationError({
                    "host_employee": "Employees can only create passes for themselves."
                })
            attrs["host_company"] = employee_profile.company
            attrs["host_employee"] = employee_profile
        elif role == "company":
            owned = get_administered_companies(user)
            host_company = attrs.get("host_company", getattr(instance, "host_company", None))
            if host_company is None:
                host_company = owned.first()
                attrs["host_company"] = host_company
            if host_company is None or not owned.filter(id=host_company.id).exists():
                raise serializers.ValidationError({
                    "host_company": "You can only manage passes for your own company."
                })

        host_company = attrs.get("host_company", getattr(instance, "host_company", None))
        host_employee = attrs.get("host_employee", getattr(instance, "host_employee", None))
        if host_company is None:
            raise serializers.ValidationError({"host_company": "This field is required."})
        if instance is None and not host_company.is_active:
            raise serializers.ValidationError({"host_company": "This company is not active."})
        if host_employee and host_employee.company_id != host_company.id:
            raise serializers.ValidationError({
                "host_employee": "Selected host employee must belong to the selected company."
            })

        valid_from = attrs.get("valid_from", getattr(instance, "valid_from", None))
        valid_until = attrs.get("valid_until", getattr(instance, "valid_until", None))
        if valid_from and valid_until:
            if valid_until <= valid_from:
                raise serializers.ValidationError({"valid_until": "Must be later than the start of validity."})
            if ("valid_until" in attrs or instance is None) and valid_until <= timezone.now():
                raise serializers.ValidationError({"valid_until": "The pass must end in the future."})
        return attrs


class VisitorPassSerializer(VisitorPassValidationMixin, serializers.ModelSerializer):
    host_company_name = serializers.CharField(source="host_company.name", read_only=True)
    host_employee_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    pass_url = serializers.SerializerMethodField()
    status = serializers.CharField(source="effective_status", read_only=True)

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
            "approved_by", "approved_at", "rejected_reason", "created_at", "updated_at",
        ]

    def validate_pass_type(self, value):
        if value == VisitorPass.PassType.WALK_IN:
            raise serializers.ValidationError("Walk-in passes are created at the gate.")
        return value

    def get_host_employee_name(self, obj):
        if obj.host_employee:
            return obj.host_employee.user.get_full_name() or obj.host_employee.user.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    def get_pass_url(self, obj):
        return f"{settings.FRONTEND_URL}/pass/{obj.pass_code}"


class PublicPassSerializer(serializers.ModelSerializer):
    """What anyone holding the pass link can see. Deliberately excludes the
    visitor's phone number, ID details, photo and vehicle."""

    host_company_name = serializers.CharField(source="host_company.name", read_only=True)
    host_employee_name = serializers.SerializerMethodField()
    status = serializers.CharField(source="effective_status", read_only=True)

    class Meta:
        model = VisitorPass
        fields = [
            "visitor_name", "visitor_company", "host_company_name", "host_employee_name",
            "qr_code_image", "pass_type", "status", "valid_from", "valid_until",
        ]

    def get_host_employee_name(self, obj):
        if obj.host_employee:
            return obj.host_employee.user.get_full_name() or obj.host_employee.user.username
        return None


class GatePassSerializer(PublicPassSerializer):
    """Full details for guards and admins verifying a pass at the gate."""

    active_entry = serializers.SerializerMethodField()

    class Meta(PublicPassSerializer.Meta):
        fields = PublicPassSerializer.Meta.fields + [
            "id", "pass_code", "visitor_phone", "visitor_email", "id_type", "id_number",
            "photo", "vehicle_number", "purpose", "rejected_reason", "active_entry",
        ]

    def get_active_entry(self, obj):
        entry = obj.entry_logs.filter(check_out_time__isnull=True).first()
        return entry.id if entry else None


class WalkInPassSerializer(VisitorPassValidationMixin, serializers.ModelSerializer):
    gate = serializers.IntegerField(required=False, write_only=True)

    class Meta:
        model = VisitorPass
        fields = [
            "visitor_name", "visitor_phone", "visitor_email", "visitor_company",
            "id_type", "id_number", "photo", "vehicle_number", "purpose",
            "host_company", "host_employee", "valid_from", "valid_until", "gate",
        ]
        extra_kwargs = {
            "valid_from": {"required": False},
            "valid_until": {"required": False},
        }

    def validate(self, attrs):
        now = timezone.now()
        attrs.setdefault("valid_from", now)
        attrs.setdefault(
            "valid_until", attrs["valid_from"] + timedelta(hours=settings.WALK_IN_VALIDITY_HOURS)
        )
        return super().validate(attrs)
