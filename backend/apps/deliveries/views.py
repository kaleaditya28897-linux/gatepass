from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrCompanyAdminOrEmployee, IsGuard
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
            company = user.administered_companies.first()
            if company:
                qs = qs.filter(company=company)
        elif user.role == "employee":
            if hasattr(user, "employee_profile"):
                qs = qs.filter(employee=user.employee_profile)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == "employee" and hasattr(user, "employee_profile"):
            serializer.save(
                employee=user.employee_profile,
                company=user.employee_profile.company,
            )
        else:
            serializer.save()

    @action(detail=True, methods=["post"])
    def arrived(self, request, pk=None):
        delivery = self.get_object()
        if delivery.status != Delivery.Status.EXPECTED:
            return Response({"detail": "Delivery is not in expected status."}, status=status.HTTP_400_BAD_REQUEST)
        delivery.status = Delivery.Status.ARRIVED
        delivery.save()
        return Response(DeliverySerializer(delivery).data)

    @action(detail=True, methods=["post"])
    def delivered(self, request, pk=None):
        delivery = self.get_object()
        if delivery.status != Delivery.Status.ARRIVED:
            return Response({"detail": "Delivery has not arrived yet."}, status=status.HTTP_400_BAD_REQUEST)
        delivery.status = Delivery.Status.DELIVERED
        delivery.save()
        return Response(DeliverySerializer(delivery).data)

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
