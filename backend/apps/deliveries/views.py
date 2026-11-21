import secrets

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrCompanyAdminOrEmployee, IsGuard
from apps.audit.utils import log_action
from apps.companies.utils import get_employee_profile
from apps.core.throttles import OTPVerifyRateThrottle
from apps.entries.models import EntryLog
from apps.entries.services import GateError, check_in_delivery, get_active_gate
from apps.notifications.tasks import notify_delivery_arrived
from .models import Delivery
from .serializers import (
    ArrivedSerializer, DeliveryGateSerializer, DeliverySerializer, VerifyOTPSerializer,
)

GUARD_ACTIONS = ("pending_gate", "arrived", "verify_otp")


class DeliveryViewSet(viewsets.ModelViewSet):
    serializer_class = DeliverySerializer
    filterset_fields = ["status", "delivery_type", "company", "employee"]
    search_fields = ["platform_name", "order_id", "delivery_person_name", "notes"]
    ordering_fields = ["created_at", "expected_at"]

    def get_permissions(self):
        if self.action in GUARD_ACTIONS:
            return [IsGuard()]
        return [IsAdminOrCompanyAdminOrEmployee()]

    def get_throttles(self):
        if self.action == "verify_otp":
            return [OTPVerifyRateThrottle()]
        return super().get_throttles()

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
        delivery = serializer.save()
        log_action(
            user=self.request.user,
            action="delivery_created",
            resource_type="delivery",
            resource_id=delivery.id,
            description=f"Created delivery for {delivery.employee.user.get_full_name()}.",
            request=self.request,
        )

    def update(self, request, *args, **kwargs):
        delivery = self.get_object()
        if delivery.status != Delivery.Status.EXPECTED:
            return Response(
                {"detail": "Only deliveries that have not arrived yet can be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        delivery = self.get_object()
        if request.user.role != "admin":
            return Response(
                {"detail": "Deliveries cannot be deleted. Cancel the delivery instead."},
                status=status.HTTP_403_FORBIDDEN,
            )
        log_action(
            user=request.user, action="delivery_deleted", resource_type="delivery",
            resource_id=delivery.id, description=f"Deleted delivery {delivery.id}.", request=request,
        )
        delivery.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        delivery = self.get_object()
        if delivery.status != Delivery.Status.EXPECTED:
            return Response(
                {"detail": "Only deliveries that have not arrived yet can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        delivery.status = Delivery.Status.CANCELLED
        delivery.save(update_fields=["status", "updated_at"])
        log_action(
            user=request.user, action="delivery_cancelled", resource_type="delivery",
            resource_id=delivery.id, description=f"Cancelled delivery {delivery.id}.", request=request,
        )
        return Response(self.get_serializer(delivery).data)

    @action(detail=True, methods=["post"], url_path="regenerate-otp")
    def regenerate_otp(self, request, pk=None):
        """Issue a fresh OTP (and clear the lock) for a delivery that is still open."""
        delivery = self.get_object()
        if delivery.status not in (Delivery.Status.EXPECTED, Delivery.Status.ARRIVED):
            return Response(
                {"detail": "This delivery is already closed."}, status=status.HTTP_400_BAD_REQUEST,
            )
        delivery.otp_code = f"{secrets.randbelow(1_000_000):06d}"
        delivery.otp_attempts = 0
        delivery.save(update_fields=["otp_code", "otp_attempts", "updated_at"])
        log_action(
            user=request.user, action="delivery_otp_regenerated", resource_type="delivery",
            resource_id=delivery.id, description=f"Regenerated OTP for delivery {delivery.id}.",
            request=request,
        )
        return Response(self.get_serializer(delivery).data)

    @action(detail=True, methods=["post"])
    def arrived(self, request, pk=None):
        serializer = ArrivedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        delivery = self.get_object()
        if delivery.status != Delivery.Status.EXPECTED:
            return Response({"detail": "Delivery is not in expected status."}, status=status.HTTP_400_BAD_REQUEST)

        person_fields = [f for f in ("delivery_person_name", "delivery_person_phone") if data.get(f)]
        try:
            with transaction.atomic():
                if person_fields:
                    for field in person_fields:
                        setattr(delivery, field, data[field])
                    delivery.save(update_fields=person_fields + ["updated_at"])
                if data.get("gate") is not None:
                    # Records the arrival in the entry log as well.
                    check_in_delivery(delivery.id, get_active_gate(data["gate"]), request.user, request)
                else:
                    delivery.status = Delivery.Status.ARRIVED
                    delivery.save(update_fields=["status", "updated_at"])
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
        except GateError as exc:
            return Response({"detail": exc.detail}, status=exc.status_code)
        delivery.refresh_from_db()
        return Response(DeliveryGateSerializer(delivery).data)

    @action(detail=True, methods=["post"], url_path="verify-otp")
    def verify_otp(self, request, pk=None):
        """Check the recipient's OTP and, only if it matches, release the delivery."""
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        max_attempts = settings.DELIVERY_OTP_MAX_ATTEMPTS
        failure = None
        with transaction.atomic():
            try:
                delivery = (
                    Delivery.objects.select_for_update()
                    .select_related("company", "employee__user")
                    .get(pk=self.get_object().pk)
                )
            except Delivery.DoesNotExist:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

            if delivery.status != Delivery.Status.ARRIVED:
                return Response(
                    {"detail": "Mark the delivery as arrived before verifying the OTP.", "verified": False},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if delivery.otp_attempts >= max_attempts:
                return Response(
                    {"detail": "Too many wrong attempts. Ask the recipient to generate a new OTP.",
                     "verified": False, "locked": True, "attempts_remaining": 0},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if secrets.compare_digest(delivery.otp_code, serializer.validated_data["otp"]):
                now = timezone.now()
                delivery.status = Delivery.Status.DELIVERED
                delivery.delivered_at = now
                delivery.save(update_fields=["status", "delivered_at", "updated_at"])
                EntryLog.objects.filter(delivery=delivery, check_out_time__isnull=True).update(
                    check_out_time=now, checked_out_by=request.user, updated_at=now,
                )
                log_action(
                    user=request.user,
                    action="delivery_delivered",
                    resource_type="delivery",
                    resource_id=delivery.id,
                    description=f"OTP verified; delivery {delivery.id} released.",
                    request=request,
                )
            else:
                Delivery.objects.filter(pk=delivery.pk).update(otp_attempts=F("otp_attempts") + 1)
                remaining = max(0, max_attempts - delivery.otp_attempts - 1)
                log_action(
                    user=request.user,
                    action="delivery_otp_failed",
                    resource_type="delivery",
                    resource_id=delivery.id,
                    description=f"Wrong OTP entered for delivery {delivery.id}.",
                    request=request,
                )
                failure = {
                    "detail": "Invalid OTP." if remaining else
                              "Invalid OTP. This delivery is now locked; ask the recipient for a new OTP.",
                    "verified": False,
                    "locked": remaining == 0,
                    "attempts_remaining": remaining,
                }
        if failure is not None:
            return Response(failure, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "detail": "OTP verified. Delivery released.",
            "verified": True,
            "delivery": DeliveryGateSerializer(delivery).data,
        })

    @action(detail=False, methods=["get"], url_path="pending-gate")
    def pending_gate(self, request):
        qs = (
            Delivery.objects.filter(status__in=["expected", "arrived"])
            .select_related("company", "employee__user")
            .order_by("-status", "expected_at", "-created_at")
        )
        qs = self.filter_queryset(qs)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(DeliveryGateSerializer(page, many=True).data)
        return Response(DeliveryGateSerializer(qs, many=True).data)
