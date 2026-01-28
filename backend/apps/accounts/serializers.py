from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "phone", "avatar", "is_active"]
        read_only_fields = ["id"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "phone", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class MeSerializer(serializers.ModelSerializer):
    company = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "phone", "avatar", "company"]

    def get_company(self, obj):
        if obj.role == User.Role.COMPANY:
            company = obj.administered_companies.first()
            if company:
                return {"id": company.id, "name": company.name, "slug": company.slug}
        elif obj.role == User.Role.EMPLOYEE:
            if hasattr(obj, "employee_profile"):
                company = obj.employee_profile.company
                return {"id": company.id, "name": company.name, "slug": company.slug}
        return None
