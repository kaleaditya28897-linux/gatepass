import csv
import io
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from apps.accounts.permissions import IsAdmin, IsAdminOrCompanyAdmin
from .models import Company, Employee
from .serializers import (
    CompanySerializer, EmployeeSerializer, EmployeeCreateSerializer,
    BulkEmployeeUploadSerializer,
)

User = get_user_model()


class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["is_active"]
    search_fields = ["name", "email"]
    ordering_fields = ["name", "created_at"]

    def get_permissions(self):
        if self.action == "stats":
            return [IsAdminOrCompanyAdmin()]
        return [IsAdmin()]

    def get_queryset(self):
        qs = Company.objects.select_related("admin").all()
        if self.request.user.role == "company":
            qs = qs.filter(admin=self.request.user)
        return qs

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        company = self.get_object()
        return Response({
            "employee_count": company.employees.count(),
            "active_passes": company.visitor_passes.filter(status="approved").count(),
            "today_entries": company.visitor_passes.filter(
                entry_logs__check_in_time__date=timezone.now().date()
            ).distinct().count(),
            "pending_deliveries": company.deliveries.filter(status__in=["expected", "arrived"]).count(),
        })


class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [IsAdminOrCompanyAdmin]
    filterset_fields = ["company", "department"]
    search_fields = ["user__first_name", "user__last_name", "user__email", "employee_id"]
    ordering_fields = ["user__first_name", "created_at"]

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

    @action(detail=False, methods=["post"], url_path="bulk-upload")
    def bulk_upload(self, request):
        serializer = BulkEmployeeUploadSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        file = serializer.validated_data["file"]
        company = serializer.validated_data["company"]
        decoded = file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(decoded))
        created = 0
        errors = []
        for i, row in enumerate(reader, start=2):
            try:
                user = User.objects.create_user(
                    username=row["username"],
                    email=row.get("email", ""),
                    first_name=row.get("first_name", ""),
                    last_name=row.get("last_name", ""),
                    phone=row.get("phone", ""),
                    password=row.get("password", "changeme123"),
                    role="employee",
                )
                Employee.objects.create(
                    user=user,
                    company=company,
                    employee_id=row.get("employee_id", ""),
                    designation=row.get("designation", ""),
                    department=row.get("department", ""),
                )
                created += 1
            except Exception as e:
                errors.append({"row": i, "error": str(e)})
        return Response({"created": created, "errors": errors}, status=status.HTTP_201_CREATED)
