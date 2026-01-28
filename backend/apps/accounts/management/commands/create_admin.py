from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Create a superadmin user for GatePass"

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin")
        parser.add_argument("--email", default="admin@gatepass.local")
        parser.add_argument("--password", default="admin123")
        parser.add_argument("--first-name", default="System")
        parser.add_argument("--last-name", default="Admin")

    def handle(self, *args, **options):
        username = options["username"]
        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.WARNING(f'User "{username}" already exists.'))
            return
        user = User.objects.create_superuser(
            username=username,
            email=options["email"],
            password=options["password"],
            first_name=options["first_name"],
            last_name=options["last_name"],
            role="admin",
        )
        self.stdout.write(self.style.SUCCESS(f'Admin user "{user.username}" created successfully.'))
