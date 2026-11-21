from django.core.management.base import BaseCommand

from apps.passes.tasks import expire_stale_passes


class Command(BaseCommand):
    help = "Mark expired visitor passes as expired (also runs automatically via Celery beat)"

    def handle(self, *args, **options):
        expired = expire_stale_passes()
        self.stdout.write(self.style.SUCCESS(f"Marked {expired} passes as expired."))
