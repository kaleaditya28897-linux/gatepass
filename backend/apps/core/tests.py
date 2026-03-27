import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_health_check_returns_ok(api_client):
    response = api_client.get(reverse("health-check"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
