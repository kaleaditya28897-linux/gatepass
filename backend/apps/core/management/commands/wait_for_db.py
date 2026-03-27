import time

from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    help = "Block until the default database connection is available."

    def add_arguments(self, parser):
        parser.add_argument("--timeout", type=int, default=60)
        parser.add_argument("--interval", type=float, default=1.0)

    def handle(self, *args, **options):
        timeout = options["timeout"]
        interval = options["interval"]
        deadline = time.monotonic() + timeout

        self.stdout.write("Waiting for database connection...")

        while True:
            try:
                connections["default"].ensure_connection()
            except OperationalError as exc:
                if time.monotonic() >= deadline:
                    raise CommandError(
                        f"Database connection was not available within {timeout} seconds."
                    ) from exc
                self.stdout.write(self.style.WARNING("Database unavailable, retrying..."))
                time.sleep(interval)
            else:
                self.stdout.write(self.style.SUCCESS("Database connection available."))
                return
