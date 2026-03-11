from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsGuard, IsAdminOrCompanyAdmin
from apps.audit.utils import log_action
from apps.companies.models import Company
from apps.notifications.tasks import notify_delivery_arrived, notify_visitor_checked_in
from apps.passes.models import VisitorPass
from apps.deliveries.models import Delivery
from apps.gates.models import Gate
from .models import EntryLog
from .serializers import EntryLogSerializer, CheckInSerializer


class EntryLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EntryLogSerializer
    filterset_fields = ["entry_type", "gate"]
    search_fields = ["visitor_name", "phone", "company_name"]
    ordering_fields = ["check_in_time"]

    def get_permissions(self):
        if self.action in ["check_in", "check_out"]:
            return [IsGuard()]
        return [IsAdminOrCompanyAdmin()]

    def get_queryset(self):
        qs = EntryLog.objects.select_related(
            "gate", "checked_in_by", "checked_out_by", "visitor_pass__host_company", "delivery__company"
        ).all()
        user = self.request.user
        if user.role == "company":
            companies = Company.objects.filter(admin=user)
            if not companies.exists():
                return qs.none()
            qs = qs.filter(
                Q(visitor_pass__host_company__admin=user)
                | Q(delivery__company__admin=user)
                | Q(company_name__in=companies.values("name"))
            ).distinct()
        return qs

    @action(detail=False, methods=["post"], url_path="check-in")
    def check_in(self, request):
        serializer = CheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            gate = Gate.objects.get(id=data["gate"], is_active=True)
        except Gate.DoesNotExist:
            return Response({"detail": "Gate not found."}, status=status.HTTP_404_NOT_FOUND)

        entry_kwargs = {
            "gate": gate,
            "checked_in_by": request.user,
        }

        if data.get("pass_code"):
            try:
                visitor_pass = VisitorPass.objects.select_related("host_company").get(pass_code=data["pass_code"])
            except VisitorPass.DoesNotExist:
                return Response({"detail": "Pass not found."}, status=status.HTTP_404_NOT_FOUND)
            if EntryLog.objects.filter(visitor_pass=visitor_pass, check_out_time__isnull=True).exists():
                return Response({"detail": "This pass is already checked in."}, status=status.HTTP_400_BAD_REQUEST)
            if visitor_pass.status != VisitorPass.Status.APPROVED:
                return Response({"detail": f"Pass status is '{visitor_pass.status}'. Cannot check in."}, status=status.HTTP_400_BAD_REQUEST)
            if visitor_pass.valid_until < timezone.now():
                return Response({"detail": "Pass has expired."}, status=status.HTTP_400_BAD_REQUEST)
            visitor_pass.status = VisitorPass.Status.CHECKED_IN
            visitor_pass.save()
            entry_kwargs.update({
                "visitor_pass": visitor_pass,
                "entry_type": EntryLog.EntryType.VISITOR,
                "visitor_name": visitor_pass.visitor_name,
                "phone": visitor_pass.visitor_phone,
                "company_name": visitor_pass.host_company.name,
            })
        elif data.get("delivery_id"):
            try:
                delivery = Delivery.objects.select_related("company").get(id=data["delivery_id"])
            except Delivery.DoesNotExist:
                return Response({"detail": "Delivery not found."}, status=status.HTTP_404_NOT_FOUND)
            if EntryLog.objects.filter(delivery=delivery, check_out_time__isnull=True).exists():
                return Response({"detail": "This delivery already has an active entry."}, status=status.HTTP_400_BAD_REQUEST)
            if delivery.status != Delivery.Status.EXPECTED:
                return Response({"detail": f"Delivery status is '{delivery.status}'. Cannot check in."}, status=status.HTTP_400_BAD_REQUEST)
            delivery.status = "arrived"
            delivery.save()
            entry_kwargs.update({
                "delivery": delivery,
                "entry_type": EntryLog.EntryType.DELIVERY,
                "visitor_name": delivery.delivery_person_name,
                "phone": delivery.delivery_person_phone,
                "company_name": delivery.company.name,
            })

        entry = EntryLog.objects.create(**entry_kwargs)
        if data.get("pass_code"):
            log_action(
                user=request.user,
                action="visitor_checked_in",
                resource_type="entry_log",
                resource_id=entry.id,
                description=f"Checked in visitor {entry.visitor_name} at {gate.name}.",
                request=request,
                extra_data={"visitor_pass_id": entry.visitor_pass_id, "gate_id": gate.id},
            )
            notify_visitor_checked_in.delay(entry.visitor_pass_id)
        else:
            log_action(
                user=request.user,
                action="delivery_checked_in",
                resource_type="entry_log",
                resource_id=entry.id,
                description=f"Checked in delivery {entry.delivery_id} at {gate.name}.",
                request=request,
                extra_data={"delivery_id": entry.delivery_id, "gate_id": gate.id},
            )
            notify_delivery_arrived.delay(entry.delivery_id)
        return Response(EntryLogSerializer(entry).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="check-out")
    def check_out(self, request, pk=None):
        try:
            entry = EntryLog.objects.get(id=pk, check_out_time__isnull=True)
        except EntryLog.DoesNotExist:
            return Response({"detail": "Active entry not found."}, status=status.HTTP_404_NOT_FOUND)
        entry.check_out_time = timezone.now()
        entry.checked_out_by = request.user
        entry.save()
        if entry.visitor_pass:
            entry.visitor_pass.status = VisitorPass.Status.CHECKED_OUT
            entry.visitor_pass.save()
        log_action(
            user=request.user,
            action="entry_checked_out",
            resource_type="entry_log",
            resource_id=entry.id,
            description=f"Checked out {entry.visitor_name}.",
            request=request,
            extra_data={"visitor_pass_id": entry.visitor_pass_id, "delivery_id": entry.delivery_id},
        )
        return Response(EntryLogSerializer(entry).data)

    @action(detail=False, methods=["get"])
    def active(self, request):
        qs = self.get_queryset().filter(check_out_time__isnull=True)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(EntryLogSerializer(page, many=True).data)
        return Response(EntryLogSerializer(qs, many=True).data)
