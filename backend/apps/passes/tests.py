import pytest
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from apps.companies.models import Company, Employee
from apps.passes.models import VisitorPass


@pytest.fixture
def company(db):
    return Company.objects.create(name="Test Corp", slug="testcorp")


@pytest.fixture
def employee_with_company(db, employee_user, company):
    return Employee.objects.create(
        user=employee_user, company=company, employee_id="E001"
    )


@pytest.fixture
def visitor_pass(db, company, employee_with_company, employee_user):
    now = timezone.now()
    return VisitorPass.objects.create(
        visitor_name="Test Visitor",
        visitor_phone="+911234567890",
        host_company=company,
        host_employee=employee_with_company,
        valid_from=now,
        valid_until=now + timedelta(hours=8),
        created_by=employee_user,
    )


@pytest.mark.django_db
class TestVisitorPasses:
    def test_verify_pass_public(self, api_client, visitor_pass):
        url = f"/api/v1/passes/verify/{visitor_pass.pass_code}/"
        response = api_client.get(url)
        assert response.status_code == 200
        assert response.data["visitor_name"] == "Test Visitor"

    def test_verify_pass_not_found(self, api_client):
        url = "/api/v1/passes/verify/00000000-0000-0000-0000-000000000000/"
        response = api_client.get(url)
        assert response.status_code == 404

    def test_approve_pass(self, authenticated_admin_client, visitor_pass, admin_user):
        url = reverse("visitor-pass-approve", args=[visitor_pass.id])
        response = authenticated_admin_client.post(url)
        assert response.status_code == 200
        visitor_pass.refresh_from_db()
        assert visitor_pass.status == "approved"
        assert visitor_pass.approved_by == admin_user
