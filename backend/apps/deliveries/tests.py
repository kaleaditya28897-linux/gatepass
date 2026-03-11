import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from apps.companies.models import Company, Employee

User = get_user_model()


@pytest.mark.django_db
def test_company_admin_cannot_create_delivery_for_other_company(
    authenticated_company_client, company_admin_user
):
    Company.objects.create(name="Managed Company", slug="managed-company", admin=company_admin_user)
    other_company = Company.objects.create(name="Other Company", slug="other-company")
    other_user = User.objects.create_user(
        username="otheremployee",
        email="otheremployee@test.com",
        password="testpass123",
        role="employee",
    )
    other_employee = Employee.objects.create(
        user=other_user,
        company=other_company,
        employee_id="EMP002",
    )

    response = authenticated_company_client.post(
        reverse("delivery-list"),
        {
            "company": other_company.id,
            "employee": other_employee.id,
            "delivery_type": "courier",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["company"] == ["You can only manage deliveries for your own company."]
