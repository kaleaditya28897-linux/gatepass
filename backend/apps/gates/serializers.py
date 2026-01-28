from rest_framework import serializers
from django.contrib.auth import get_user_model
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
    email = serializers.CharField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = GuardProfile
        fields = [
            "id", "user", "username", "full_name", "email", "phone",
            "badge_number", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class GuardCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone = serializers.CharField(required=False, default="")
    password = serializers.CharField(write_only=True, min_length=8)
    badge_number = serializers.CharField()

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            phone=validated_data.get("phone", ""),
            password=validated_data["password"],
            role="guard",
        )
        guard = GuardProfile.objects.create(user=user, badge_number=validated_data["badge_number"])
        return guard


class GuardShiftSerializer(serializers.ModelSerializer):
    guard_name = serializers.CharField(source="guard.user.get_full_name", read_only=True)
    gate_name = serializers.CharField(source="gate.name", read_only=True)

    class Meta:
        model = GuardShift
        fields = [
            "id", "guard", "guard_name", "gate", "gate_name",
            "shift_start", "shift_end", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
