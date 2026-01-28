from rest_framework import serializers
from .models import EntryLog


class EntryLogSerializer(serializers.ModelSerializer):
    gate_name = serializers.CharField(source="gate.name", read_only=True)
    checked_in_by_name = serializers.SerializerMethodField()
    checked_out_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EntryLog
        fields = [
            "id", "visitor_pass", "delivery", "entry_type",
            "gate", "gate_name",
            "checked_in_by", "checked_in_by_name",
            "checked_out_by", "checked_out_by_name",
            "check_in_time", "check_out_time",
            "visitor_name", "phone", "company_name",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "checked_in_by", "checked_out_by",
            "check_in_time", "check_out_time", "created_at", "updated_at",
        ]

    def get_checked_in_by_name(self, obj):
        if obj.checked_in_by:
            return obj.checked_in_by.get_full_name()
        return None

    def get_checked_out_by_name(self, obj):
        if obj.checked_out_by:
            return obj.checked_out_by.get_full_name()
        return None


class CheckInSerializer(serializers.Serializer):
    pass_code = serializers.UUIDField(required=False)
    delivery_id = serializers.IntegerField(required=False)
    gate = serializers.IntegerField()

    def validate(self, data):
        if not data.get("pass_code") and not data.get("delivery_id"):
            raise serializers.ValidationError("Either pass_code or delivery_id is required.")
        return data
