from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from apps.accounts.permissions import IsAdmin, IsGuard
from .models import Gate, GuardProfile, GuardShift
from .serializers import (
    GateSerializer, GuardProfileSerializer, GuardCreateSerializer, GuardShiftSerializer,
)


class GateViewSet(viewsets.ModelViewSet):
    queryset = Gate.objects.all()
    serializer_class = GateSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["gate_type", "is_active"]
    search_fields = ["name", "code"]


class GuardViewSet(viewsets.ModelViewSet):
    serializer_class = GuardProfileSerializer
    permission_classes = [IsAdmin]
    search_fields = ["user__first_name", "user__last_name", "badge_number"]

    def get_queryset(self):
        return GuardProfile.objects.select_related("user").all()

    def get_serializer_class(self):
        if self.action == "create":
            return GuardCreateSerializer
        return GuardProfileSerializer


class GuardShiftViewSet(viewsets.ModelViewSet):
    serializer_class = GuardShiftSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return GuardShift.objects.select_related("guard__user", "gate").all()

    @action(detail=False, methods=["get"], url_path="my-current", permission_classes=[IsGuard])
    def my_current(self, request):
        now = timezone.now()
        shift = GuardShift.objects.filter(
            guard__user=request.user,
            shift_start__lte=now,
            shift_end__gte=now,
            is_active=True,
        ).select_related("gate").first()
        if shift:
            return Response(GuardShiftSerializer(shift).data)
        return Response({"detail": "No active shift."}, status=404)
