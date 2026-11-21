from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()


def run_password_validators(password, user=None):
    """Apply Django's AUTH_PASSWORD_VALIDATORS and surface errors as DRF errors."""
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))
    return password


def validate_new_username(username):
    if User.objects.filter(username__iexact=username).exists():
        raise serializers.ValidationError("A user with this username already exists.")
    return username


def company_summary(user):
    if user.role == User.Role.COMPANY:
        company = user.administered_companies.first()
        if company:
            return {"id": company.id, "name": company.name, "slug": company.slug}
    elif user.role == User.Role.EMPLOYEE:
        profile = getattr(user, "employee_profile", None)
        if profile is not None:
            company = profile.company
            return {"id": company.id, "name": company.name, "slug": company.slug}
    return None


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False)


class MeSerializer(serializers.ModelSerializer):
    company = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "phone", "avatar", "company", "employee_id",
        ]
        read_only_fields = ["id", "username", "role", "avatar", "company", "employee_id"]

    def get_company(self, obj):
        return company_summary(obj)

    def get_employee_id(self, obj):
        """Primary key of the employee profile (used when hosting passes)."""
        if obj.role == User.Role.EMPLOYEE:
            profile = getattr(obj, "employee_profile", None)
            return profile.id if profile is not None else None
        return None


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        return run_password_validators(value, user=self.context["request"].user)


class SetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(trim_whitespace=False)

    def validate_new_password(self, value):
        return run_password_validators(value, user=self.context.get("target_user"))


class UserSerializer(serializers.ModelSerializer):
    """Admin-facing user management (building admins and company admins).

    Employees and guards are created through their own endpoints because they
    need a profile; they can still be listed, deactivated and have their
    password reset here.
    """

    CREATABLE_ROLES = (User.Role.ADMIN, User.Role.COMPANY)

    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    company = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "role",
            "phone", "is_active", "password", "company", "last_login", "date_joined",
        ]
        read_only_fields = ["id", "last_login", "date_joined"]

    def get_company(self, obj):
        return company_summary(obj)

    def validate_username(self, value):
        if self.instance is None:
            return validate_new_username(value)
        if value != self.instance.username:
            raise serializers.ValidationError("Usernames cannot be changed.")
        return value

    def validate_role(self, value):
        if self.instance is None:
            if value not in self.CREATABLE_ROLES:
                raise serializers.ValidationError(
                    "Only admin and company admin accounts are created here. "
                    "Use the Employees or Guards pages for those roles."
                )
        elif value != self.instance.role:
            raise serializers.ValidationError("A user's role cannot be changed.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        if self.instance is None:
            if not attrs.get("password"):
                raise serializers.ValidationError({"password": "This field is required."})
            if "role" not in attrs:
                raise serializers.ValidationError({"role": "This field is required."})
            run_password_validators(attrs["password"])
        else:
            attrs.pop("password", None)  # use the set-password action instead
            if (
                request is not None
                and self.instance.pk == request.user.pk
                and attrs.get("is_active") is False
            ):
                raise serializers.ValidationError({"is_active": "You cannot deactivate your own account."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
