from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsAdminOrGuardReadOnly, IsGuard
from apps.audit.utils import log_action
from .models import Gate, GuardProfile, GuardShift
from .serializers import (
    GateSerializer, GuardCreateSerializer, GuardProfileSerializer, GuardShiftSerializer,
)


class GateViewSet(viewsets.ModelViewSet):
    queryset = Gate.objects.all().order_by("name")
    serializer_class = GateSerializer
    # Guards need to read the gate list to choose where they are posted.
    permission_classes = [IsAdminOrGuardReadOnly]
    filterset_fields = ["gate_type", "is_active"]
    search_fields = ["name", "code", "location"]

    def perform_create(self, serializer):
        gate = serializer.save()
        log_action(
            user=self.request.user, action="gate_created", resource_type="gate",
            resource_id=gate.id, description=f"Created gate {gate.name}.", request=self.request,
        )

    def perform_destroy(self, instance):
        log_action(
            user=self.request.user, action="gate_deleted", resource_type="gate",
            resource_id=instance.id, description=f"Deleted gate {instance.name}.", request=self.request,
        )
        instance.delete()


class GuardViewSet(viewsets.ModelViewSet):
    serializer_class = GuardProfileSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["is_active"]
    search_fields = ["user__first_name", "user__last_name", "user__username", "badge_number"]

    def get_queryset(self):
        return GuardProfile.objects.select_related("user").order_by("user__first_name", "user__last_name")

    def get_serializer_class(self):
        if self.action == "create":
            return GuardCreateSerializer
        return GuardProfileSerializer

    def perform_create(self, serializer):
        guard = serializer.save()
        log_action(
            user=self.request.user, action="guard_created", resource_type="guard",
            resource_id=guard.id, description=f"Created guard {guard.user.username}.", request=self.request,
        )

    def perform_destroy(self, instance):
        log_action(
            user=self.request.user, action="guard_deleted", resource_type="guard",
            resource_id=instance.id, description=f"Removed guard {instance.user.username}.",
            request=self.request,
        )
        instance.user.delete()


class GuardShiftViewSet(viewsets.ModelViewSet):
    serializer_class = GuardShiftSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["guard", "gate", "is_active"]
    ordering_fields = ["shift_start"]

    def get_queryset(self):
        qs = GuardShift.objects.select_related("guard__user", "gate").all()
        if self.request.query_params.get("upcoming") in ("1", "true"):
            qs = qs.filter(shift_end__gte=timezone.now()).order_by("shift_start")
        return qs

    @action(detail=False, methods=["get"], url_path="my-current", permission_classes=[IsGuard])
    def my_current(self, request):
        now = timezone.now()
        shift = GuardShift.objects.filter(
            guard__user=request.user,
            shift_start__lte=now,
            shift_end__gte=now,
            is_active=True,
            gate__is_active=True,
        ).select_related("gate", "guard__user").first()
        if shift:
            return Response(GuardShiftSerializer(shift).data)
        # Not an error: most guards simply choose their gate on the device.
        return Response(status=204)
