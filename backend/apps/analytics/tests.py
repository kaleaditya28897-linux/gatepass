from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from apps.companies.models import Company, Employee
from apps.entries.models import EntryLog
from apps.gates.models import Gate
from apps.passes.models import VisitorPass

User = get_user_model()


@pytest.mark.django_db
def test_company_analytics_are_scoped_to_owned_company(
    authenticated_company_client, company_admin_user, employee_user
):
    managed_company = Company.objects.create(
        name="Managed Company",
        slug="managed-company",
        admin=company_admin_user,
    )
    other_company = Company.objects.create(name="Other Company", slug="other-company")
    managed_employee = Employee.objects.create(
        user=employee_user,
        company=managed_company,
        employee_id="EMP001",
    )
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
    gate = Gate.objects.create(name="Main Gate", code="MAIN")
    now = timezone.now()

    managed_pass = VisitorPass.objects.create(
        visitor_name="Managed Visitor",
        visitor_phone="+911111111111",
        host_company=managed_company,
        host_employee=managed_employee,
        valid_from=now,
        valid_until=now + timedelta(hours=2),
        status=VisitorPass.Status.APPROVED,
        created_by=employee_user,
    )
    other_pass = VisitorPass.objects.create(
        visitor_name="Other Visitor",
        visitor_phone="+922222222222",
        host_company=other_company,
        host_employee=other_employee,
        valid_from=now,
        valid_until=now + timedelta(hours=2),
        status=VisitorPass.Status.APPROVED,
        created_by=other_user,
    )

    EntryLog.objects.create(
        visitor_pass=managed_pass,
        entry_type=EntryLog.EntryType.VISITOR,
        gate=gate,
        visitor_name=managed_pass.visitor_name,
        phone=managed_pass.visitor_phone,
        company_name=managed_company.name,
    )
    EntryLog.objects.create(
        visitor_pass=other_pass,
        entry_type=EntryLog.EntryType.VISITOR,
        gate=gate,
        visitor_name=other_pass.visitor_name,
        phone=other_pass.visitor_phone,
        company_name=other_company.name,
    )

    response = authenticated_company_client.get(reverse("analytics-entries-by-date"))

    assert response.status_code == 200
    assert sum(item["count"] for item in response.data) == 1
