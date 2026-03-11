from datetime import timedelta
from django.db.models import Count, Q
from django.db.models.functions import TruncDate, TruncHour
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin, IsAdminOrCompanyAdmin
from apps.entries.models import EntryLog
from apps.passes.models import VisitorPass
from apps.deliveries.models import Delivery
from apps.companies.models import Company


def _get_days(request):
    try:
        days = int(request.query_params.get("days", 30))
    except (TypeError, ValueError):
        days = 30
    return max(1, min(days, 365))


def _filter_entries_for_user(user):
    qs = EntryLog.objects.all()
    if user.role != "company":
        return qs

    companies = Company.objects.filter(admin=user)
    if not companies.exists():
        return qs.none()

    return qs.filter(
        Q(visitor_pass__host_company__admin=user)
        | Q(delivery__company__admin=user)
        | Q(company_name__in=companies.values("name"))
    ).distinct()


def _filter_deliveries_for_user(user):
    qs = Delivery.objects.all()
    if user.role != "company":
        return qs
    return qs.filter(company__admin=user)


@api_view(["GET"])
@permission_classes([IsAdmin])
def overview(request):
    today = timezone.now().date()
    return Response({
        "total_companies": Company.objects.filter(is_active=True).count(),
        "total_passes_today": VisitorPass.objects.filter(created_at__date=today).count(),
        "active_visitors": EntryLog.objects.filter(check_out_time__isnull=True, entry_type="visitor").count(),
        "pending_deliveries": Delivery.objects.filter(status__in=["expected", "arrived"]).count(),
        "checked_in_today": EntryLog.objects.filter(check_in_time__date=today).count(),
        "checked_out_today": EntryLog.objects.filter(check_out_time__date=today).count(),
    })


@api_view(["GET"])
@permission_classes([IsAdminOrCompanyAdmin])
def entries_by_date(request):
    days = _get_days(request)
    start_date = timezone.now() - timedelta(days=days)
    data = (
        _filter_entries_for_user(request.user).filter(check_in_time__gte=start_date)
        .annotate(date=TruncDate("check_in_time"))
        .values("date")
        .annotate(count=Count("id"))
        .order_by("date")
    )
    return Response(list(data))


@api_view(["GET"])
@permission_classes([IsAdminOrCompanyAdmin])
def entries_by_gate(request):
    days = _get_days(request)
    start_date = timezone.now() - timedelta(days=days)
    data = (
        _filter_entries_for_user(request.user).filter(check_in_time__gte=start_date)
        .values("gate__name")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    return Response(list(data))


@api_view(["GET"])
@permission_classes([IsAdmin])
def peak_hours(request):
    days = _get_days(request)
    start_date = timezone.now() - timedelta(days=days)
    data = (
        EntryLog.objects.filter(check_in_time__gte=start_date)
        .annotate(hour=TruncHour("check_in_time"))
        .values("hour")
        .annotate(count=Count("id"))
        .order_by("hour")
    )
    return Response(list(data))


@api_view(["GET"])
@permission_classes([IsAdminOrCompanyAdmin])
def delivery_stats(request):
    days = _get_days(request)
    start_date = timezone.now() - timedelta(days=days)
    qs = _filter_deliveries_for_user(request.user).filter(created_at__gte=start_date)
    return Response({
        "total": qs.count(),
        "by_type": list(qs.values("delivery_type").annotate(count=Count("id")).order_by("-count")),
        "by_status": list(qs.values("status").annotate(count=Count("id")).order_by("-count")),
        "by_platform": list(
            qs.exclude(platform_name="")
            .values("platform_name")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        ),
    })
