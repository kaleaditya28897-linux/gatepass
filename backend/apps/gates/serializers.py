from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.accounts.serializers import run_password_validators, validate_new_username
from .models import Gate, GuardProfile, GuardShift

User = get_user_model()


class GateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Gate
        fields = ["id", "name", "code", "location", "gate_type", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class GuardProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.get_full_name", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)
    email = serializers.EmailField(source="user.email", required=False, allow_blank=True)
    phone = serializers.CharField(source="user.phone", required=False, allow_blank=True, max_length=20)

    class Meta:
        model = GuardProfile
        fields = [
            "id", "user", "username", "full_name", "first_name", "last_name", "email", "phone",
            "badge_number", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at"]

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        user = instance.user
        for field, value in user_data.items():
            setattr(user, field, value)
        # An inactive guard must not be able to sign in.
        if "is_active" in validated_data:
            user.is_active = validated_data["is_active"]
        user.save()
        return super().update(instance, validated_data)


class GuardCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    phone = serializers.CharField(required=False, allow_blank=True, default="", max_length=20)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    badge_number = serializers.CharField(max_length=50)

    def validate_username(self, value):
        return validate_new_username(value)

    def validate_password(self, value):
        return run_password_validators(value)

    def validate_badge_number(self, value):
        if GuardProfile.objects.filter(badge_number=value).exists():
            raise serializers.ValidationError("This badge number is already assigned.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            first_name=validated_data["first_name"],
            last_name=validated_data.get("last_name", ""),
            phone=validated_data.get("phone", ""),
            password=validated_data["password"],
            role="guard",
        )
        return GuardProfile.objects.create(user=user, badge_number=validated_data["badge_number"])

    def to_representation(self, instance):
        return GuardProfileSerializer(instance, context=self.context).data


class GuardShiftSerializer(serializers.ModelSerializer):
    guard_name = serializers.SerializerMethodField()
    gate_name = serializers.CharField(source="gate.name", read_only=True)

    class Meta:
        model = GuardShift
        fields = [
            "id", "guard", "guard_name", "gate", "gate_name",
            "shift_start", "shift_end", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_guard_name(self, obj):
        return obj.guard.user.get_full_name() or obj.guard.user.username

    def validate(self, attrs):
        start = attrs.get("shift_start", getattr(self.instance, "shift_start", None))
        end = attrs.get("shift_end", getattr(self.instance, "shift_end", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"shift_end": "Shift end must be after shift start."})
        return attrs
