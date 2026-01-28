import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestAuth:
    def test_login_success(self, api_client, admin_user):
        url = reverse("auth-login")
        response = api_client.post(url, {"username": "testadmin", "password": "testpass123"})
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data
        assert response.data["user"]["username"] == "testadmin"
        assert response.data["user"]["role"] == "admin"

    def test_login_invalid_credentials(self, api_client, admin_user):
        url = reverse("auth-login")
        response = api_client.post(url, {"username": "testadmin", "password": "wrongpass"})
        assert response.status_code == 401

    def test_me_authenticated(self, authenticated_admin_client, admin_user):
        url = reverse("auth-me")
        response = authenticated_admin_client.get(url)
        assert response.status_code == 200
        assert response.data["username"] == "testadmin"

    def test_me_unauthenticated(self, api_client):
        url = reverse("auth-me")
        response = api_client.get(url)
        assert response.status_code == 401
