import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditLog

User = get_user_model()
pytestmark = pytest.mark.django_db
STRONG = "Tr1cky-Horse-Battery"


def test_login_is_throttled_per_account_not_per_office(api_client, admin_user, employee_user, monkeypatch):
    from apps.core.throttles import LoginAddressRateThrottle, LoginRateThrottle
    rates = {"login": "3/min", "login_address": "8/min"}
    monkeypatch.setattr(LoginRateThrottle, "THROTTLE_RATES", rates)
    monkeypatch.setattr(LoginAddressRateThrottle, "THROTTLE_RATES", rates)
    attempt = lambda username, password: api_client.post(  # noqa: E731
        "/api/v1/auth/login/", {"username": username, "password": password}).status_code

    assert [attempt("testadmin", "nope") for _ in range(5)] == [401, 401, 401, 429, 429]
    # Case tricks do not reset the counter, and the right password is refused while locked.
    assert attempt("TestAdmin", "testpass123") == 429
    # A colleague on the same network is not affected...
    assert attempt("testemployee", "testpass123") == 200
    # ...until the address as a whole is clearly spraying usernames.
    assert [attempt(f"user{n}", "x") for n in range(4)] == [401, 429, 429, 429]


def test_failed_and_successful_logins_are_audited(api_client, admin_user):
    api_client.post("/api/v1/auth/login/", {"username": "testadmin", "password": "nope"})
    api_client.post("/api/v1/auth/login/", {"username": "testadmin", "password": "testpass123"})
    assert AuditLog.objects.filter(action="login_failed").count() == 1
    assert AuditLog.objects.filter(action="login", user=admin_user).count() == 1


def test_inactive_user_cannot_login(api_client, admin_user):
    admin_user.is_active = False
    admin_user.save()
    r = api_client.post("/api/v1/auth/login/", {"username": "testadmin", "password": "testpass123"})
    assert r.status_code == 401


def test_forged_forwarded_header_does_not_break_login(api_client, admin_user):
    r = api_client.post(
        "/api/v1/auth/login/", {"username": "testadmin", "password": "testpass123"},
        HTTP_X_FORWARDED_FOR="not-an-ip, <script>",
    )
    assert r.status_code == 200
    assert AuditLog.objects.get(action="login").ip_address == "127.0.0.1"


def test_token_refresh_roundtrip(api_client, admin_user):
    login = api_client.post("/api/v1/auth/login/", {"username": "testadmin", "password": "testpass123"}).data
    r = api_client.post("/api/v1/auth/token/refresh/", {"refresh": login["refresh"]})
    assert r.status_code == 200 and r.data["access"] and r.data["refresh"]
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    assert client.get("/api/v1/auth/me/").status_code == 200


def test_me_reports_company_and_employee_profile(client_for, employee, company):
    r = client_for(employee.user).get("/api/v1/auth/me/")
    assert r.data["company"]["id"] == company.id
    assert r.data["employee_id"] == employee.id


def test_me_patch_cannot_escalate_role(client_for, employee):
    r = client_for(employee.user).patch("/api/v1/auth/me/", {"role": "admin", "phone": "+91999"}, format="json")
    assert r.status_code == 200
    employee.user.refresh_from_db()
    assert employee.user.role == "employee"
    assert employee.user.phone == "+91999"


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
def test_change_password(client_for, employee_user, api_client):
    client = client_for(employee_user)
    url = "/api/v1/auth/change-password/"
    assert client.post(url, {"current_password": "wrong", "new_password": STRONG}).status_code == 400
    assert client.post(url, {"current_password": "testpass123", "new_password": "12345678"}).status_code == 400
    assert client.post(url, {"current_password": "testpass123", "new_password": STRONG}).status_code == 200
    assert api_client.post("/api/v1/auth/login/", {"username": "testemployee", "password": STRONG}).status_code == 200
    assert api_client.post(url, {"current_password": STRONG, "new_password": STRONG}).status_code == 401


class TestUserManagement:
    url = "/api/v1/auth/users/"

    def test_only_admin_can_manage_users(self, client_for, company_admin_user, employee_user, guard_user):
        for user in (company_admin_user, employee_user, guard_user):
            assert client_for(user).get(self.url).status_code == 403
            assert client_for(user).post(self.url, {}).status_code == 403

    def test_create_company_admin_account(self, authenticated_admin_client, api_client):
        r = authenticated_admin_client.post(self.url, {
            "username": "newco", "password": STRONG, "role": "company",
            "first_name": "New", "last_name": "Co", "email": "n@co.test",
        }, format="json")
        assert r.status_code == 201, r.data
        assert "password" not in r.data
        assert api_client.post("/api/v1/auth/login/", {"username": "newco", "password": STRONG}).status_code == 200

    def test_cannot_create_employee_or_guard_here(self, authenticated_admin_client):
        for role in ("employee", "guard"):
            r = authenticated_admin_client.post(
                self.url, {"username": f"x{role}", "password": STRONG, "role": role}, format="json")
            assert r.status_code == 400

    def test_weak_or_missing_password_and_duplicate_username_rejected(self, authenticated_admin_client, admin_user):
        post = lambda data: authenticated_admin_client.post(self.url, data, format="json")  # noqa: E731
        assert post({"username": "a1", "role": "admin"}).status_code == 400
        assert post({"username": "a1", "role": "admin", "password": "password"}).status_code == 400
        assert post({"username": "TESTADMIN", "role": "admin", "password": STRONG}).status_code == 400

    def test_role_and_username_are_immutable(self, authenticated_admin_client, employee_user):
        url = f"{self.url}{employee_user.id}/"
        assert authenticated_admin_client.patch(url, {"role": "admin"}, format="json").status_code == 400
        assert authenticated_admin_client.patch(url, {"username": "zzz"}, format="json").status_code == 400

    def test_deactivate_and_reset_password(self, authenticated_admin_client, employee_user, api_client):
        url = f"{self.url}{employee_user.id}/"
        r = authenticated_admin_client.post(url + "set-password/", {"new_password": STRONG}, format="json")
        assert r.status_code == 200
        assert api_client.post("/api/v1/auth/login/", {"username": "testemployee", "password": STRONG}).status_code == 200
        assert authenticated_admin_client.patch(url, {"is_active": False}, format="json").status_code == 200
        assert api_client.post("/api/v1/auth/login/", {"username": "testemployee", "password": STRONG}).status_code == 401

    def test_admin_cannot_deactivate_self_or_delete_users(self, authenticated_admin_client, admin_user):
        url = f"{self.url}{admin_user.id}/"
        assert authenticated_admin_client.patch(url, {"is_active": False}, format="json").status_code == 400
        assert authenticated_admin_client.delete(url).status_code == 405


def test_deactivated_user_token_stops_working(admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(admin_user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    assert client.get("/api/v1/auth/me/").status_code == 200
    admin_user.is_active = False
    admin_user.save()
    assert client.get("/api/v1/auth/me/").status_code == 401
    assert APIClient().post("/api/v1/auth/token/refresh/", {"refresh": str(refresh)}).status_code == 401
