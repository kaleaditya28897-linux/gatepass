import csv
import io

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import (
    IsAdmin, IsAdminOrCompanyAdmin, IsAdminOrCompanyAdminOrGuard,
)
from apps.audit.utils import log_action
from .models import Company, Employee
from .serializers import (
    BulkEmployeeUploadSerializer, CompanyDirectorySerializer, CompanySerializer,
    EmployeeCreateSerializer, EmployeeDirectorySerializer, EmployeeSerializer,
)

User = get_user_model()

BULK_UPLOAD_MAX_ROWS = 500


class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    filterset_fields = ["is_active"]
    search_fields = ["name", "email", "floor", "suite_number"]
    ordering_fields = ["name", "created_at"]

    def get_permissions(self):
        if self.action == "stats":
            return [IsAdminOrCompanyAdmin()]
        if self.action == "directory":
            return [IsAdminOrCompanyAdminOrGuard()]
        return [IsAdmin()]

    def get_queryset(self):
        qs = Company.objects.select_related("admin").all()
        if self.request.user.role == "company":
            qs = qs.filter(admin=self.request.user)
        return qs

    def perform_create(self, serializer):
        company = serializer.save()
        log_action(
            user=self.request.user, action="company_created", resource_type="company",
            resource_id=company.id, description=f"Created company {company.name}.", request=self.request,
        )

    def perform_update(self, serializer):
        company = serializer.save()
        log_action(
            user=self.request.user, action="company_updated", resource_type="company",
            resource_id=company.id, description=f"Updated company {company.name}.", request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        company = self.get_object()
        # Deleting a company would wipe its pass and delivery history.
        if company.visitor_passes.exists() or company.deliveries.exists() or company.employees.exists():
            return Response(
                {"detail": "This company has employees or visit history and cannot be deleted. "
                           "Mark it inactive instead."},
                status=status.HTTP_409_CONFLICT,
            )
        log_action(
            user=request.user, action="company_deleted", resource_type="company",
            resource_id=company.id, description=f"Deleted company {company.name}.", request=request,
        )
        company.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], pagination_class=None)
    def directory(self, request):
        """Lightweight list of active companies for pickers (e.g. walk-ins at the gate)."""
        qs = Company.objects.filter(is_active=True).order_by("name")
        if request.user.role == "company":
            qs = qs.filter(admin=request.user)
        return Response(CompanyDirectorySerializer(qs, many=True).data)

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        company = self.get_object()
        today = timezone.localdate()
        return Response({
            "employee_count": company.employees.count(),
            "pending_passes": company.visitor_passes.filter(status="pending").count(),
            "active_passes": company.visitor_passes.filter(status="approved").count(),
            "visitors_inside": company.visitor_passes.filter(status="checked_in").count(),
            "today_entries": company.visitor_passes.filter(
                entry_logs__check_in_time__date=today
            ).distinct().count(),
            "pending_deliveries": company.deliveries.filter(status__in=["expected", "arrived"]).count(),
        })


class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    filterset_fields = ["company", "department"]
    search_fields = [
        "user__first_name", "user__last_name", "user__email", "user__username",
        "employee_id", "department", "designation",
    ]
    ordering_fields = ["user__first_name", "created_at"]
    ordering = ["user__first_name", "user__last_name"]

    def get_permissions(self):
        if self.action == "directory":
            return [IsAdminOrCompanyAdminOrGuard()]
        return [IsAdminOrCompanyAdmin()]

    def get_serializer_class(self):
        if self.action == "create":
            return EmployeeCreateSerializer
        return EmployeeSerializer

    def get_queryset(self):
        qs = Employee.objects.select_related("user", "company").all()
        user = self.request.user
        if user.role == "company":
            qs = qs.filter(company__admin=user)
        return qs

    def perform_create(self, serializer):
        employee = serializer.save()
        log_action(
            user=self.request.user, action="employee_created", resource_type="employee",
            resource_id=employee.id, request=self.request,
            description=f"Added employee {employee.user.username} to {employee.company.name}.",
        )

    def perform_update(self, serializer):
        employee = serializer.save()
        log_action(
            user=self.request.user, action="employee_updated", resource_type="employee",
            resource_id=employee.id, request=self.request,
            description=f"Updated employee {employee.user.username}.",
        )

    def perform_destroy(self, instance):
        log_action(
            user=self.request.user, action="employee_deleted", resource_type="employee",
            resource_id=instance.id, request=self.request,
            description=f"Removed employee {instance.user.username} from {instance.company.name}.",
        )
        # Removing the login as well; the profile row cascades.
        instance.user.delete()

    @action(detail=False, methods=["get"], pagination_class=None)
    def directory(self, request):
        """Names of active employees for host pickers. Requires ?company=<id> for guards/admins."""
        qs = Employee.objects.select_related("user").filter(
            user__is_active=True, company__is_active=True
        ).order_by("user__first_name", "user__last_name")
        if request.user.role == "company":
            qs = qs.filter(company__admin=request.user)
        company_id = request.query_params.get("company")
        if company_id:
            if not company_id.isdigit():
                raise ValidationError({"company": "Invalid company."})
            qs = qs.filter(company_id=company_id)
        elif request.user.role != "company":
            raise ValidationError({"company": "This query parameter is required."})
        return Response(EmployeeDirectorySerializer(qs, many=True).data)

    @action(detail=False, methods=["post"], url_path="bulk-upload")
    def bulk_upload(self, request):
        serializer = BulkEmployeeUploadSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        company = serializer.validated_data["company"]
        try:
            decoded = serializer.validated_data["file"].read().decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ValidationError({"file": "The file must be a UTF-8 encoded CSV."})
        reader = csv.DictReader(io.StringIO(decoded))
        headers = {(h or "").strip().lower() for h in (reader.fieldnames or [])}
        required = {"username", "email", "first_name", "last_name", "password"}
        missing = required - headers
        if missing:
            raise ValidationError({
                "file": f"Missing required column(s): {', '.join(sorted(missing))}. "
                        "Expected: username, email, first_name, last_name, password, "
                        "phone, employee_id, designation, department."
            })
        rows = list(reader)
        if len(rows) > BULK_UPLOAD_MAX_ROWS:
            raise ValidationError({"file": f"A maximum of {BULK_UPLOAD_MAX_ROWS} rows can be uploaded at once."})

        created = 0
        errors = []
        for line_number, raw in enumerate(rows, start=2):
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items() if k}
            if not any(row.values()):
                continue
            row_serializer = EmployeeCreateSerializer(
                data={**{k: row.get(k, "") for k in (
                    "username", "email", "first_name", "last_name", "phone",
                    "password", "employee_id", "designation", "department",
                )}, "company": company.id},
                context={"request": request},
            )
            if not row_serializer.is_valid():
                errors.append({
                    "row": line_number,
                    "username": row.get("username", ""),
                    "error": _flatten_errors(row_serializer.errors),
                })
                continue
            try:
                with transaction.atomic():
                    row_serializer.save()
                created += 1
            except Exception as exc:  # noqa: BLE001 - report the row, keep going
                errors.append({"row": line_number, "username": row.get("username", ""), "error": str(exc)})
        log_action(
            user=request.user, action="employees_bulk_uploaded", resource_type="company",
            resource_id=company.id, request=request,
            description=f"Bulk upload for {company.name}: {created} created, {len(errors)} failed.",
        )
        return Response(
            {"created": created, "errors": errors},
            status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST,
        )


def _flatten_errors(errors):
    parts = []
    for field, messages in errors.items():
        if isinstance(messages, (list, tuple)):
            text = " ".join(str(m) for m in messages)
        else:
            text = str(messages)
        parts.append(text if field == "non_field_errors" else f"{field}: {text}")
    return "; ".join(parts)
