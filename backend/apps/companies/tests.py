import pytest
from django.urls import reverse
from apps.companies.models import Company


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
