from datetime import timedelta

import pytest
from django.utils import timezone

from apps.companies.models import Company, Employee
from apps.gates.models import Gate
from apps.passes.models import VisitorPass


@pytest.mark.django_db
def test_duplicate_check_in_is_rejected(authenticated_guard_client, employee_user):
    company = Company.objects.create(name="Test Corp", slug="test-corp")
    employee = Employee.objects.create(user=employee_user, company=company, employee_id="EMP001")
    gate = Gate.objects.create(name="Main Gate", code="MAIN")
    now = timezone.now()
    visitor_pass = VisitorPass.objects.create(
        visitor_name="Repeat Visitor",
        visitor_phone="+911234567890",
        host_company=company,
        host_employee=employee,
        valid_from=now,
        valid_until=now + timedelta(hours=4),
        status=VisitorPass.Status.APPROVED,
        created_by=employee_user,
    )

    payload = {"pass_code": str(visitor_pass.pass_code), "gate": gate.id}
    first_response = authenticated_guard_client.post("/api/v1/entries/check-in/", payload, format="json")
    second_response = authenticated_guard_client.post("/api/v1/entries/check-in/", payload, format="json")

    assert first_response.status_code == 201
    assert second_response.status_code == 400
    assert second_response.data["detail"] == "This pass is already checked in."
