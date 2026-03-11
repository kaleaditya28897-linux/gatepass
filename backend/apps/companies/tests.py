import pytest
from datetime import timedelta
from django.urls import reverse
from django.utils import timezone
from apps.companies.models import Company, Employee
from apps.deliveries.models import Delivery
from apps.passes.models import VisitorPass


@pytest.mark.django_db
class TestCompanies:
    def test_list_companies_admin(self, authenticated_admin_client):
        Company.objects.create(name="Test Company", slug="test-company")
        url = reverse("company-list")
        response = authenticated_admin_client.get(url)
        assert response.status_code == 200
        assert response.data["count"] == 1

    def test_create_company_admin(self, authenticated_admin_client):
        url = reverse("company-list")
        data = {
            "name": "New Company",
            "slug": "new-company",
            "floor": "1st",
            "suite_number": "101",
        }
        response = authenticated_admin_client.post(url, data)
        assert response.status_code == 201
        assert Company.objects.filter(slug="new-company").exists()

    def test_list_companies_unauthorized(self, api_client):
        url = reverse("company-list")
        response = api_client.get(url)
        assert response.status_code == 401

    def test_company_admin_can_view_own_company_stats(
        self, authenticated_company_client, company_admin_user, employee_user
    ):
        company = Company.objects.create(
            name="Managed Company",
            slug="managed-company",
            admin=company_admin_user,
        )
        employee = Employee.objects.create(
            user=employee_user,
            company=company,
            employee_id="EMP001",
        )
        now = timezone.now()
        VisitorPass.objects.create(
            visitor_name="Visitor",
            visitor_phone="+911234567890",
            host_company=company,
            host_employee=employee,
            valid_from=now,
            valid_until=now + timedelta(hours=2),
            status=VisitorPass.Status.APPROVED,
            created_by=employee_user,
        )
        Delivery.objects.create(
            company=company,
            employee=employee,
            delivery_type=Delivery.DeliveryType.COURIER,
        )

        url = reverse("company-stats", args=[company.id])
        response = authenticated_company_client.get(url)

        assert response.status_code == 200
        assert response.data["employee_count"] == 1
        assert response.data["active_passes"] == 1
        assert response.data["pending_deliveries"] == 1

    def test_company_admin_cannot_create_employee_for_other_company(
        self, authenticated_company_client, company_admin_user
    ):
        Company.objects.create(
            name="Managed Company",
            slug="managed-company",
            admin=company_admin_user,
        )
        other_company = Company.objects.create(name="Other Company", slug="other-company")

        url = reverse("employee-list")
        response = authenticated_company_client.post(
            url,
            {
                "username": "otheremployee",
                "email": "otheremployee@test.com",
                "first_name": "Other",
                "last_name": "Employee",
                "password": "testpass123",
                "company": other_company.id,
                "employee_id": "EMP002",
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data["company"] == ["You can only create employees for your own company."]
