import csv

import django_filters
from django.db.models import Q
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import (
    IsAdmin, IsAdminOrCompanyAdminOrGuard, IsAdminOrGuard, IsGuard,
)
from apps.companies.models import Company
from .models import EntryLog
from .serializers import CheckInSerializer, EntryLogSerializer
from .services import GateError, check_in_delivery, check_in_visitor, check_out_entry, get_active_gate


class EntryLogFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="check_in_time", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="check_in_time", lookup_expr="date__lte")
    active = django_filters.BooleanFilter(field_name="check_out_time", lookup_expr="isnull")

    class Meta:
        model = EntryLog
        fields = ["entry_type", "gate", "date_from", "date_to", "active"]


class _Echo:
    def write(self, value):
        return value


class EntryLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EntryLogSerializer
    filterset_class = EntryLogFilter
    search_fields = ["visitor_name", "phone", "company_name"]
    ordering_fields = ["check_in_time", "check_out_time"]

    def get_permissions(self):
        if self.action == "check_in":
            return [IsGuard()]
        if self.action == "check_out":
            return [IsAdminOrGuard()]
        if self.action == "export":
            return [IsAdmin()]
        # Guards need the log to see who is inside the building.
        return [IsAdminOrCompanyAdminOrGuard()]

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
            gate = get_active_gate(data["gate"])
            if data.get("pass_code"):
                entry = check_in_visitor(data["pass_code"], gate, request.user, request)
            else:
                entry = check_in_delivery(data["delivery_id"], gate, request.user, request)
        except GateError as exc:
            return Response({"detail": exc.detail}, status=exc.status_code)
        return Response(EntryLogSerializer(entry).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="check-out")
    def check_out(self, request, pk=None):
        try:
            entry = check_out_entry(pk, request.user, request)
        except (GateError, ValueError) as exc:
            if isinstance(exc, ValueError):
                return Response({"detail": "Active entry not found."}, status=status.HTTP_404_NOT_FOUND)
            return Response({"detail": exc.detail}, status=exc.status_code)
        return Response(EntryLogSerializer(entry).data)

    @action(detail=False, methods=["get"])
    def active(self, request):
        qs = self.filter_queryset(self.get_queryset()).filter(check_out_time__isnull=True)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(EntryLogSerializer(page, many=True).data)
        return Response(EntryLogSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def export(self, request):
        """CSV download of the (filtered) entry log for the building admin."""
        qs = self.filter_queryset(self.get_queryset())

        def fmt(value):
            return timezone.localtime(value).strftime("%Y-%m-%d %H:%M:%S") if value else ""

        def clean(value):
            # Stop spreadsheet apps from treating user-supplied text as a formula.
            text = str(value or "")
            return "'" + text if text[:1] in ("=", "+", "-", "@") else text

        def rows():
            writer = csv.writer(_Echo())
            yield writer.writerow([
                "Name", "Phone", "Company", "Type", "Gate",
                "Check in", "Checked in by", "Check out", "Checked out by",
            ])
            for entry in qs.iterator(chunk_size=500):
                yield writer.writerow([
                    clean(entry.visitor_name), clean(entry.phone), clean(entry.company_name),
                    entry.get_entry_type_display(), clean(entry.gate.name if entry.gate else ""),
                    fmt(entry.check_in_time),
                    clean(entry.checked_in_by.get_full_name() if entry.checked_in_by else ""),
                    fmt(entry.check_out_time),
                    clean(entry.checked_out_by.get_full_name() if entry.checked_out_by else ""),
                ])

        response = StreamingHttpResponse(rows(), content_type="text/csv")
        filename = f"gatepass-entries-{timezone.localdate().isoformat()}.csv"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
