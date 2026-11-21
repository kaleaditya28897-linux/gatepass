from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


class Command(BaseCommand):
    help = "Seed demo data for GatePass (development/demo only: creates well-known passwords)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force", action="store_true",
            help="Allow seeding outside DEBUG mode. Never use on a live building.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "seed_demo_data creates accounts with publicly known passwords and is disabled "
                "outside development. Re-run with --force on a throwaway demo system only."
            )
        from apps.companies.models import Company, Employee
        from apps.gates.models import Gate, GuardProfile, GuardShift
        from apps.passes.models import VisitorPass
        from apps.deliveries.models import Delivery

        now = timezone.now()

        # Admin user
        admin, _ = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@gatepass.local",
                "first_name": "System",
                "last_name": "Admin",
                "role": "admin",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if not admin.password:
            admin.set_password("admin123")
            admin.save()

        # Company admin users
        ca1, _ = User.objects.get_or_create(
            username="techcorp_admin",
            defaults={
                "email": "admin@techcorp.com",
                "first_name": "Rahul",
                "last_name": "Sharma",
                "role": "company",
                "phone": "+919876543210",
            },
        )
        if not ca1.password:
            ca1.set_password("password123")
            ca1.save()

        ca2, _ = User.objects.get_or_create(
            username="designhub_admin",
            defaults={
                "email": "admin@designhub.com",
                "first_name": "Priya",
                "last_name": "Patel",
                "role": "company",
                "phone": "+919876543211",
            },
        )
        if not ca2.password:
            ca2.set_password("password123")
            ca2.save()

        # Companies
        company1, _ = Company.objects.get_or_create(
            slug="techcorp",
            defaults={
                "name": "TechCorp Solutions",
                "admin": ca1,
                "floor": "3rd Floor",
                "suite_number": "301",
                "phone": "+911234567890",
                "email": "info@techcorp.com",
                "max_employees": 100,
            },
        )

        company2, _ = Company.objects.get_or_create(
            slug="designhub",
            defaults={
                "name": "DesignHub Creative",
                "admin": ca2,
                "floor": "5th Floor",
                "suite_number": "502",
                "phone": "+911234567891",
                "email": "info@designhub.com",
                "max_employees": 50,
            },
        )

        # Employee users
        emp_users = []
        for i, (fn, ln, co) in enumerate([
            ("Amit", "Kumar", company1),
            ("Sneha", "Gupta", company1),
            ("Vikram", "Singh", company1),
            ("Anjali", "Reddy", company2),
            ("Karan", "Mehta", company2),
        ]):
            u, _ = User.objects.get_or_create(
                username=f"{fn.lower()}.{ln.lower()}",
                defaults={
                    "email": f"{fn.lower()}@{co.slug}.com",
                    "first_name": fn,
                    "last_name": ln,
                    "role": "employee",
                    "phone": f"+91987654{3220 + i}",
                },
            )
            if not u.password:
                u.set_password("password123")
                u.save()
            emp, _ = Employee.objects.get_or_create(
                user=u,
                defaults={
                    "company": co,
                    "employee_id": f"EMP{1001 + i}",
                    "designation": ["Developer", "Designer", "Manager", "Designer", "Developer"][i],
                    "department": ["Engineering", "Engineering", "Management", "Design", "Engineering"][i],
                },
            )
            emp_users.append((u, emp))

        # Gates
        gate1, _ = Gate.objects.get_or_create(
            code="GATE-A",
            defaults={"name": "Main Entrance", "location": "Ground Floor Lobby", "gate_type": "pedestrian"},
        )
        gate2, _ = Gate.objects.get_or_create(
            code="GATE-B",
            defaults={"name": "Parking Entry", "location": "Basement Level 1", "gate_type": "vehicle"},
        )
        gate3, _ = Gate.objects.get_or_create(
            code="GATE-C",
            defaults={"name": "Service Entry", "location": "Ground Floor Rear", "gate_type": "service"},
        )

        # Guard users
        for i, (fn, ln, badge) in enumerate([
            ("Raju", "Yadav", "G001"),
            ("Sunil", "Verma", "G002"),
        ]):
            gu, _ = User.objects.get_or_create(
                username=f"guard.{fn.lower()}",
                defaults={
                    "email": f"{fn.lower()}.guard@gatepass.local",
                    "first_name": fn,
                    "last_name": ln,
                    "role": "guard",
                    "phone": f"+91987654{3230 + i}",
                },
            )
            if not gu.password:
                gu.set_password("password123")
                gu.save()
            gp, _ = GuardProfile.objects.get_or_create(user=gu, defaults={"badge_number": badge})
            # A shift covering all of today (local time) so the demo guard can always work.
            day_start = timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0)
            GuardShift.objects.get_or_create(
                guard=gp,
                gate=[gate1, gate2][i],
                shift_start=day_start,
                defaults={"shift_end": day_start + timedelta(days=1)},
            )

        # Sample visitor passes
        emp1_user, emp1 = emp_users[0]
        VisitorPass.objects.get_or_create(
            visitor_name="John Doe",
            host_employee=emp1,
            defaults={
                "visitor_phone": "+919999888801",
                "visitor_email": "john@example.com",
                "visitor_company": "Acme Corp",
                "purpose": "Business meeting",
                "host_company": company1,
                "pass_type": "pre_approved",
                "status": "approved",
                "valid_from": now,
                "valid_until": now + timedelta(hours=8),
                "created_by": emp1_user,
                "approved_by": ca1,
                "approved_at": now,
            },
        )

        VisitorPass.objects.get_or_create(
            visitor_name="Jane Smith",
            host_employee=emp1,
            defaults={
                "visitor_phone": "+919999888802",
                "visitor_company": "GlobalTech",
                "purpose": "Interview",
                "host_company": company1,
                "pass_type": "pre_approved",
                "status": "pending",
                "valid_from": now + timedelta(days=1),
                "valid_until": now + timedelta(days=1, hours=4),
                "created_by": emp1_user,
            },
        )

        # Sample deliveries
        emp2_user, emp2 = emp_users[1]
        Delivery.objects.get_or_create(
            employee=emp2,
            platform_name="Swiggy",
            order_id="SWG12345",
            defaults={
                "company": company1,
                "delivery_type": "food_order",
                "status": "expected",
                "expected_at": now + timedelta(minutes=30),
                "notes": "Lunch order",
            },
        )

        Delivery.objects.get_or_create(
            employee=emp1,
            platform_name="Amazon",
            order_id="AMZ98765",
            defaults={
                "company": company1,
                "delivery_type": "courier",
                "status": "expected",
                "expected_at": now + timedelta(hours=2),
                "notes": "Office supplies",
            },
        )

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully!"))
        self.stdout.write(f"  Admin: admin / admin123")
        self.stdout.write(f"  Company admin: techcorp_admin / password123")
        self.stdout.write(f"  Company admin: designhub_admin / password123")
        self.stdout.write(f"  Employee: amit.kumar / password123")
        self.stdout.write(f"  Guard: guard.raju / password123")
