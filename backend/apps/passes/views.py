import io
import uuid

import qrcode
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrCompanyAdmin, IsAdminOrCompanyAdminOrEmployee, IsGuard
from apps.audit.utils import log_action
from apps.companies.utils import get_employee_profile
from apps.core.throttles import PassVerifyRateThrottle
from apps.entries.services import GateError, check_in_visitor, get_active_gate
from apps.notifications.tasks import notify_pass_approved
from .models import VisitorPass
from .serializers import (
    GatePassSerializer, PublicPassSerializer, VisitorPassSerializer, WalkInPassSerializer,
)


def generate_qr_code(pass_obj):
    url = f"{settings.FRONTEND_URL}/pass/{pass_obj.pass_code}"
    img = qrcode.make(url, box_size=10, border=4)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    pass_obj.qr_code_image.save(
        f"qr_{pass_obj.pass_code}.png",
        ContentFile(buffer.getvalue()),
        save=False,
    )
    pass_obj.save(update_fields=["qr_code_image", "updated_at"])


def approve_pass(visitor_pass, user):
    visitor_pass.status = VisitorPass.Status.APPROVED
    visitor_pass.approved_by = user
    visitor_pass.approved_at = timezone.now()
    visitor_pass.rejected_reason = ""
    visitor_pass.save()
    generate_qr_code(visitor_pass)
    pass_id = visitor_pass.id
    transaction.on_commit(lambda: notify_pass_approved.delay(pass_id))


class VisitorPassViewSet(viewsets.ModelViewSet):
    serializer_class = VisitorPassSerializer
    permission_classes = [IsAdminOrCompanyAdminOrEmployee]
    filterset_fields = ["status", "pass_type", "host_company", "host_employee"]
    search_fields = ["visitor_name", "visitor_phone", "visitor_email", "visitor_company"]
    ordering_fields = ["created_at", "valid_from"]

    def get_queryset(self):
        qs = VisitorPass.objects.select_related(
            "host_company", "host_employee__user", "created_by", "approved_by"
        ).all()
        user = self.request.user
        if user.role == "company":
            qs = qs.filter(host_company__admin=user)
        elif user.role == "employee":
            employee_profile = get_employee_profile(user)
            if employee_profile is None:
                return qs.none()
            qs = qs.filter(host_employee=employee_profile)
        return qs

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        visitor_pass = serializer.save(created_by=user)
        log_action(
            user=user,
            action="pass_created",
            resource_type="visitor_pass",
            resource_id=visitor_pass.id,
            description=f"Created visitor pass for {visitor_pass.visitor_name}.",
            request=self.request,
        )
        # Passes raised by people who could approve them anyway skip the queue.
        if user.role in ("admin", "company"):
            approve_pass(visitor_pass, user)
            log_action(
                user=user,
                action="pass_approved",
                resource_type="visitor_pass",
                resource_id=visitor_pass.id,
                description=f"Auto-approved visitor pass for {visitor_pass.visitor_name}.",
                request=self.request,
            )

    def update(self, request, *args, **kwargs):
        visitor_pass = self.get_object()
        if visitor_pass.effective_status != VisitorPass.Status.PENDING:
            return Response(
                {"detail": "Only pending passes can be edited. Cancel this pass and create a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        visitor_pass = self.get_object()
        if request.user.role != "admin":
            return Response(
                {"detail": "Passes cannot be deleted. Cancel the pass instead."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if visitor_pass.entry_logs.exists():
            return Response(
                {"detail": "This pass has entry records and cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )
        log_action(
            user=request.user, action="pass_deleted", resource_type="visitor_pass",
            resource_id=visitor_pass.id, request=request,
            description=f"Deleted visitor pass for {visitor_pass.visitor_name}.",
        )
        visitor_pass.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrCompanyAdmin])
    @transaction.atomic
    def approve(self, request, pk=None):
        visitor_pass = self.get_object()
        if visitor_pass.status != VisitorPass.Status.PENDING:
            return Response(
                {"detail": "Only pending passes can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if visitor_pass.is_past_validity:
            return Response(
                {"detail": "This pass has already expired and can no longer be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        approve_pass(visitor_pass, request.user)
        log_action(
            user=request.user,
            action="pass_approved",
            resource_type="visitor_pass",
            resource_id=visitor_pass.id,
            description=f"Approved visitor pass for {visitor_pass.visitor_name}.",
            request=request,
        )
        return Response(self.get_serializer(visitor_pass).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrCompanyAdmin])
    def reject(self, request, pk=None):
        visitor_pass = self.get_object()
        if visitor_pass.status != VisitorPass.Status.PENDING:
            return Response(
                {"detail": "Only pending passes can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        visitor_pass.status = VisitorPass.Status.REJECTED
        visitor_pass.rejected_reason = str(request.data.get("reason", ""))[:1000]
        visitor_pass.save()
        log_action(
            user=request.user,
            action="pass_rejected",
            resource_type="visitor_pass",
            resource_id=visitor_pass.id,
            description=f"Rejected visitor pass for {visitor_pass.visitor_name}.",
            request=request,
            extra_data={"reason": visitor_pass.rejected_reason},
        )
        return Response(self.get_serializer(visitor_pass).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        visitor_pass = self.get_object()
        if visitor_pass.status not in (VisitorPass.Status.PENDING, VisitorPass.Status.APPROVED):
            return Response(
                {"detail": "Only pending or approved passes can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        visitor_pass.status = VisitorPass.Status.CANCELLED
        visitor_pass.save()
        log_action(
            user=request.user,
            action="pass_cancelled",
            resource_type="visitor_pass",
            resource_id=visitor_pass.id,
            description=f"Cancelled visitor pass for {visitor_pass.visitor_name}.",
            request=request,
        )
        return Response(self.get_serializer(visitor_pass).data)

    @action(
        detail=False, methods=["get"], url_path="verify/(?P<code>[^/.]+)",
        permission_classes=[AllowAny], throttle_classes=[PassVerifyRateThrottle],
    )
    def verify(self, request, code=None):
        not_found = Response({"detail": "Pass not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            pass_code = uuid.UUID(str(code))
        except ValueError:
            return not_found
        try:
            visitor_pass = VisitorPass.objects.select_related(
                "host_company", "host_employee__user"
            ).get(pass_code=pass_code)
        except VisitorPass.DoesNotExist:
            return not_found
        user = request.user
        is_gate_staff = user.is_authenticated and user.role in ("guard", "admin")
        serializer_class = GatePassSerializer if is_gate_staff else PublicPassSerializer
        return Response(serializer_class(visitor_pass, context={"request": request}).data)

    @action(detail=False, methods=["post"], url_path="walk-in", permission_classes=[IsGuard])
    def walk_in(self, request):
        serializer = WalkInPassSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        gate_id = serializer.validated_data.pop("gate", None)
        entry = None
        try:
            with transaction.atomic():
                gate = get_active_gate(gate_id) if gate_id is not None else None
                visitor_pass = serializer.save(
                    created_by=request.user,
                    pass_type=VisitorPass.PassType.WALK_IN,
                    status=VisitorPass.Status.APPROVED,
                    approved_by=request.user,
                    approved_at=timezone.now(),
                )
                generate_qr_code(visitor_pass)
                log_action(
                    user=request.user,
                    action="walk_in_pass_created",
                    resource_type="visitor_pass",
                    resource_id=visitor_pass.id,
                    description=f"Created walk-in pass for {visitor_pass.visitor_name}.",
                    request=request,
                )
                if gate is not None:
                    entry = check_in_visitor(visitor_pass.pass_code, gate, request.user, request)
                    visitor_pass.refresh_from_db()
        except GateError as exc:
            return Response({"detail": exc.detail}, status=exc.status_code)
        if entry is None:
            # Only send the pass link when the visitor is not already walking in.
            pass_id = visitor_pass.id
            transaction.on_commit(lambda: notify_pass_approved.delay(pass_id))
        data = VisitorPassSerializer(visitor_pass, context={"request": request}).data
        data["entry"] = entry.id if entry else None
        return Response(data, status=status.HTTP_201_CREATED)
