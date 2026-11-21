from celery import shared_task
from django.utils import timezone

from .models import VisitorPass


def expire_stale_passes():
    """Mark pending/approved passes whose validity window has ended as expired."""
    return VisitorPass.objects.filter(
        status__in=[VisitorPass.Status.PENDING, VisitorPass.Status.APPROVED],
        valid_until__lt=timezone.now(),
    ).update(status=VisitorPass.Status.EXPIRED, updated_at=timezone.now())


@shared_task
def expire_passes():
    return expire_stale_passes()
