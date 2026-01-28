import io
import qrcode
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrCompanyAdmin, IsAdminOrCompanyAdminOrEmployee, IsGuard
from .models import VisitorPass
from .serializers import VisitorPassSerializer, VisitorPassVerifySerializer, WalkInPassSerializer


def generate_qr_code(pass_obj):
    url = f"{settings.FRONTEND_URL}/pass/{pass_obj.pass_code}"
    img = qrcode.make(url, box_size=10, border=4)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    pass_obj.qr_code_image.save(
        f"qr_{pass_obj.pass_code}.png",
        ContentFile(buffer.read()),
        save=True,
    )


class VisitorPassViewSet(viewsets.ModelViewSet):
    serializer_class = VisitorPassSerializer
    permission_classes = [IsAdminOrCompanyAdminOrEmployee]
    filterset_fields = ["status", "pass_type", "host_company"]
    search_fields = ["visitor_name", "visitor_phone", "visitor_email", "pass_code"]
    ordering_fields = ["created_at", "valid_from"]

    def get_queryset(self):
        qs = VisitorPass.objects.select_related(
            "host_company", "host_employee__user", "created_by", "approved_by"
        ).all()
        user = self.request.user
        if user.role == "company":
            company = user.administered_companies.first()
            if company:
                qs = qs.filter(host_company=company)
        elif user.role == "employee":
            if hasattr(user, "employee_profile"):
                qs = qs.filter(host_employee=user.employee_profile)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        kwargs = {"created_by": user}
        if user.role == "employee" and hasattr(user, "employee_profile"):
            kwargs["host_employee"] = user.employee_profile
            kwargs["host_company"] = user.employee_profile.company
        serializer.save(**kwargs)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrCompanyAdmin])
    def approve(self, request, pk=None):
        visitor_pass = self.get_object()
        if visitor_pass.status != VisitorPass.Status.PENDING:
            return Response(
                {"detail": "Only pending passes can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        visitor_pass.status = VisitorPass.Status.APPROVED
        visitor_pass.approved_by = request.user
        visitor_pass.approved_at = timezone.now()
        visitor_pass.save()
        generate_qr_code(visitor_pass)
        return Response(VisitorPassSerializer(visitor_pass).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrCompanyAdmin])
    def reject(self, request, pk=None):
        visitor_pass = self.get_object()
        if visitor_pass.status != VisitorPass.Status.PENDING:
            return Response(
                {"detail": "Only pending passes can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        visitor_pass.status = VisitorPass.Status.REJECTED
        visitor_pass.rejected_reason = request.data.get("reason", "")
        visitor_pass.save()
        return Response(VisitorPassSerializer(visitor_pass).data)

    @action(detail=False, methods=["get"], url_path="verify/(?P<code>[^/.]+)", permission_classes=[AllowAny])
    def verify(self, request, code=None):
        try:
            visitor_pass = VisitorPass.objects.select_related(
                "host_company", "host_employee__user"
            ).get(pass_code=code)
        except VisitorPass.DoesNotExist:
            return Response({"detail": "Pass not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(VisitorPassVerifySerializer(visitor_pass).data)

    @action(detail=False, methods=["post"], url_path="walk-in", permission_classes=[IsGuard])
    def walk_in(self, request):
        serializer = WalkInPassSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        visitor_pass = serializer.save(
            created_by=request.user,
            pass_type=VisitorPass.PassType.WALK_IN,
            status=VisitorPass.Status.APPROVED,
            approved_by=request.user,
            approved_at=timezone.now(),
        )
        generate_qr_code(visitor_pass)
        return Response(VisitorPassSerializer(visitor_pass).data, status=status.HTTP_201_CREATED)
