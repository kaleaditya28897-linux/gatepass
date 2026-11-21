import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="testadmin",
        email="admin@test.com",
        password="testpass123",
        role="admin",
        is_staff=True,
    )


@pytest.fixture
def company_admin_user(db):
    return User.objects.create_user(
        username="testcompanyadmin",
        email="companyadmin@test.com",
        password="testpass123",
        role="company",
    )


@pytest.fixture
def employee_user(db):
    return User.objects.create_user(
        username="testemployee",
        email="employee@test.com",
        password="testpass123",
        role="employee",
    )


@pytest.fixture
def guard_user(db):
    return User.objects.create_user(
        username="testguard",
        email="guard@test.com",
        password="testpass123",
        role="guard",
    )


@pytest.fixture
def authenticated_admin_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def authenticated_company_client(api_client, company_admin_user):
    api_client.force_authenticate(user=company_admin_user)
    return api_client


@pytest.fixture
def authenticated_guard_client(api_client, guard_user):
    api_client.force_authenticate(user=guard_user)
    return api_client


# --- Shared domain fixtures -------------------------------------------------

@pytest.fixture(autouse=True)
def _clear_cache():
    """Throttle counters live in the cache; keep tests independent."""
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def client_for():
    """Return a factory giving each user their own authenticated API client."""
    def make(user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client
    return make


@pytest.fixture
def company(db, company_admin_user):
    from apps.companies.models import Company
    return Company.objects.create(name="Acme Towers", slug="acme", admin=company_admin_user, max_employees=5)


@pytest.fixture
def other_company(db):
    from apps.companies.models import Company
    admin = User.objects.create_user(username="otheradmin", password="testpass123", role="company")
    return Company.objects.create(name="Other Co", slug="other", admin=admin)


@pytest.fixture
def employee(db, employee_user, company):
    from apps.companies.models import Employee
    employee_user.phone = "+919000000001"
    employee_user.first_name = "Asha"
    employee_user.last_name = "Rao"
    employee_user.save()
    return Employee.objects.create(user=employee_user, company=company, employee_id="E1")


@pytest.fixture
def other_employee(db, other_company):
    from apps.companies.models import Employee
    user = User.objects.create_user(username="otheremp", password="testpass123", role="employee")
    return Employee.objects.create(user=user, company=other_company, employee_id="E1")


@pytest.fixture
def gate(db):
    from apps.gates.models import Gate
    return Gate.objects.create(name="Main Gate", code="MAIN")


@pytest.fixture
def guard(db, guard_user):
    from apps.gates.models import GuardProfile
    return GuardProfile.objects.create(user=guard_user, badge_number="G-1")


@pytest.fixture
def make_pass(db, company, employee):
    from datetime import timedelta
    from django.utils import timezone
    from apps.passes.models import VisitorPass

    def make(**overrides):
        now = timezone.now()
        data = {
            "visitor_name": "Vik Visitor",
            "visitor_phone": "+919111111111",
            "host_company": company,
            "host_employee": employee,
            "valid_from": now - timedelta(minutes=5),
            "valid_until": now + timedelta(hours=4),
            "status": VisitorPass.Status.APPROVED,
            "created_by": employee.user,
        }
        data.update(overrides)
        return VisitorPass.objects.create(**data)
    return make


@pytest.fixture
def make_delivery(db, company, employee):
    from apps.deliveries.models import Delivery

    def make(**overrides):
        data = {"company": company, "employee": employee, "platform_name": "Swiggy"}
        data.update(overrides)
        return Delivery.objects.create(**data)
    return make
