from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrCompanyAdminOrEmployee, IsGuard
from apps.audit.utils import log_action
from apps.companies.utils import get_employee_profile
from apps.notifications.tasks import notify_delivery_arrived
from .models import Delivery
from .serializers import DeliverySerializer, DeliveryGateSerializer, VerifyOTPSerializer


class DeliveryViewSet(viewsets.ModelViewSet):
    serializer_class = DeliverySerializer
    filterset_fields = ["status", "delivery_type", "company"]
    search_fields = ["platform_name", "order_id", "delivery_person_name"]
    ordering_fields = ["created_at", "expected_at"]

    def get_permissions(self):
        if self.action in ["pending_gate", "arrived", "delivered", "verify_otp"]:
            return [IsGuard()]
        return [IsAdminOrCompanyAdminOrEmployee()]

    def get_queryset(self):
        qs = Delivery.objects.select_related("company", "employee__user").all()
        user = self.request.user
        if user.role == "company":
            qs = qs.filter(company__admin=user)
        elif user.role == "employee":
            employee_profile = get_employee_profile(user)
            if employee_profile is None:
                return qs.none()
            qs = qs.filter(employee=employee_profile)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == "employee":
            employee_profile = get_employee_profile(user)
            if employee_profile is None:
                raise ValidationError("Employee profile not found.")
            delivery = serializer.save(
                employee=employee_profile,
                company=employee_profile.company,
            )
        else:
            delivery = serializer.save()
        log_action(
            user=user,
            action="delivery_created",
            resource_type="delivery",
            resource_id=delivery.id,
            description=f"Created delivery for {delivery.employee.user.get_full_name()}.",
            request=self.request,
        )

    @action(detail=True, methods=["post"])
    def arrived(self, request, pk=None):
        delivery = self.get_object()
        if delivery.status != Delivery.Status.EXPECTED:
            return Response({"detail": "Delivery is not in expected status."}, status=status.HTTP_400_BAD_REQUEST)
        delivery.status = Delivery.Status.ARRIVED
        delivery.save()
        log_action(
            user=request.user,
            action="delivery_arrived",
            resource_type="delivery",
            resource_id=delivery.id,
            description=f"Marked delivery {delivery.id} as arrived.",
            request=request,
        )
        delivery_id = delivery.id
        transaction.on_commit(lambda: notify_delivery_arrived.delay(delivery_id))
        return Response(DeliveryGateSerializer(delivery).data)

    @action(detail=True, methods=["post"])
    def delivered(self, request, pk=None):
        delivery = self.get_object()
        if delivery.status != Delivery.Status.ARRIVED:
            return Response({"detail": "Delivery has not arrived yet."}, status=status.HTTP_400_BAD_REQUEST)
        delivery.status = Delivery.Status.DELIVERED
        delivery.save()
        log_action(
            user=request.user,
            action="delivery_delivered",
            resource_type="delivery",
            resource_id=delivery.id,
            description=f"Marked delivery {delivery.id} as delivered.",
            request=request,
        )
        return Response(DeliveryGateSerializer(delivery).data)

    @action(detail=True, methods=["post"], url_path="verify-otp")
    def verify_otp(self, request, pk=None):
        delivery = self.get_object()
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if delivery.otp_code == serializer.validated_data["otp"]:
            return Response({"detail": "OTP verified successfully.", "verified": True})
        return Response({"detail": "Invalid OTP.", "verified": False}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], url_path="pending-gate")
    def pending_gate(self, request):
        qs = Delivery.objects.filter(status__in=["expected", "arrived"]).select_related("company", "employee__user")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(DeliveryGateSerializer(page, many=True).data)
        return Response(DeliveryGateSerializer(qs, many=True).data)
