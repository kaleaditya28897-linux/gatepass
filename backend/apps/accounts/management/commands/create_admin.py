import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()

DEV_DEFAULT_PASSWORD = "admin123"


class Command(BaseCommand):
    help = (
        "Create the first admin user for GatePass. In production a password must be "
        "supplied with --password or the GATEPASS_ADMIN_PASSWORD environment variable."
    )

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin")
        parser.add_argument("--email", default="admin@gatepass.local")
        parser.add_argument("--password", default=None)
        parser.add_argument("--first-name", default="System")
        parser.add_argument("--last-name", default="Admin")

    def handle(self, *args, **options):
        username = options["username"]
        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.WARNING(f'User "{username}" already exists.'))
            return
        password = options["password"] or os.environ.get("GATEPASS_ADMIN_PASSWORD")
        if not password:
            if not settings.DEBUG:
                raise CommandError(
                    "Refusing to create an admin with the default password outside development. "
                    "Pass --password or set GATEPASS_ADMIN_PASSWORD."
                )
            password = DEV_DEFAULT_PASSWORD
        elif not settings.DEBUG:
            try:
                validate_password(password)
            except ValidationError as exc:
                raise CommandError("Password rejected: " + " ".join(exc.messages))
        user = User.objects.create_superuser(
            username=username,
            email=options["email"],
            password=password,
            first_name=options["first_name"],
            last_name=options["last_name"],
            role="admin",
        )
        self.stdout.write(self.style.SUCCESS(f'Admin user "{user.username}" created successfully.'))
