from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.utils import log_action
from apps.core.throttles import LoginAddressRateThrottle, LoginRateThrottle
from .permissions import IsAdmin
from .serializers import (
    ChangePasswordSerializer, LoginSerializer, MeSerializer,
    SetPasswordSerializer, UserSerializer,
)

User = get_user_model()


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle, LoginAddressRateThrottle])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data["username"]
    user = authenticate(
        request=request,
        username=username,
        password=serializer.validated_data["password"],
    )
    if user is None:
        log_action(
            user=None,
            action="login_failed",
            resource_type="user",
            description=f"Failed login attempt for '{username[:150]}'.",
            request=request,
        )
        return Response({"detail": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)
    refresh = RefreshToken.for_user(user)
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    log_action(
        user=user, action="login", resource_type="user", resource_id=user.id,
        description=f"{user.username} signed in.", request=request,
    )
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": MeSerializer(user, context={"request": request}).data,
    })


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me_view(request):
    if request.method == "PATCH":
        serializer = MeSerializer(request.user, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    return Response(MeSerializer(request.user, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    request.user.set_password(serializer.validated_data["new_password"])
    request.user.save(update_fields=["password"])
    log_action(
        user=request.user, action="password_changed", resource_type="user",
        resource_id=request.user.id, description="Changed own password.", request=request,
    )
    return Response({"detail": "Password updated."})


class UserViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
    mixins.UpdateModelMixin, viewsets.GenericViewSet,
):
    """Admin-only account management. Accounts are deactivated, never deleted,
    so the audit trail keeps pointing at a real user."""

    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["role", "is_active"]
    search_fields = ["username", "first_name", "last_name", "email", "phone"]
    ordering_fields = ["username", "date_joined", "last_login"]
    queryset = User.objects.select_related("employee_profile__company").order_by("username")

    def perform_create(self, serializer):
        user = serializer.save()
        log_action(
            user=self.request.user, action="user_created", resource_type="user", resource_id=user.id,
            description=f"Created {user.role} account '{user.username}'.", request=self.request,
        )

    def perform_update(self, serializer):
        user = serializer.save()
        log_action(
            user=self.request.user, action="user_updated", resource_type="user", resource_id=user.id,
            description=f"Updated account '{user.username}'.", request=self.request,
            extra_data={"is_active": user.is_active},
        )

    @action(detail=True, methods=["post"], url_path="set-password")
    def set_password(self, request, pk=None):
        user = self.get_object()
        serializer = SetPasswordSerializer(data=request.data, context={"target_user": user})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        log_action(
            user=request.user, action="password_reset", resource_type="user", resource_id=user.id,
            description=f"Reset password for '{user.username}'.", request=request,
        )
        return Response({"detail": "Password updated."})
