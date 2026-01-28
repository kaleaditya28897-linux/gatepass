from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.passes.models import VisitorPass


class Command(BaseCommand):
    help = "Mark expired visitor passes as expired"

    def handle(self, *args, **options):
        now = timezone.now()
        expired = VisitorPass.objects.filter(
            status__in=["pending", "approved"],
            valid_until__lt=now,
        ).update(status="expired")
        self.stdout.write(self.style.SUCCESS(f"Marked {expired} passes as expired."))
