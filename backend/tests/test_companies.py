import io

import pytest
from django.contrib.auth import get_user_model

from apps.companies.models import Company, Employee

User = get_user_model()
pytestmark = pytest.mark.django_db
STRONG = "Tr1cky-Horse-Battery"
EMP_URL = "/api/v1/companies/employees/"


def employee_payload(**overrides):
    data = {
        "username": "new.emp", "email": "new@acme.test", "first_name": "New", "last_name": "Emp",
        "password": STRONG, "employee_id": "E99", "department": "Ops",
    }
    data.update(overrides)
    return data


class TestCompanies:
    def test_create_company_with_admin_account(self, authenticated_admin_client, api_client):
        r = authenticated_admin_client.post("/api/v1/companies/", {
            "name": "Zen Labs", "slug": "zen-labs",
            "admin_account": {"username": "zen_admin", "password": STRONG, "first_name": "Zed", "email": "z@zen.test"},
        }, format="json")
        assert r.status_code == 201, r.data
        assert r.data["admin_username"] == "zen_admin"
        login = api_client.post("/api/v1/auth/login/", {"username": "zen_admin", "password": STRONG})
        assert login.data["user"]["role"] == "company"
        assert login.data["user"]["company"]["slug"] == "zen-labs"

    def test_bad_admin_account_rolls_back_company(self, authenticated_admin_client):
        r = authenticated_admin_client.post("/api/v1/companies/", {
            "name": "Zen Labs", "slug": "zen-labs",
            "admin_account": {"username": "zen_admin", "password": "123"},
        }, format="json")
        assert r.status_code == 400
        assert not Company.objects.filter(slug="zen-labs").exists()
        assert not User.objects.filter(username="zen_admin").exists()

    def test_admin_must_be_unassigned_company_role_user(self, authenticated_admin_client, company, employee_user,
                                                        company_admin_user):
        post = lambda admin: authenticated_admin_client.post(  # noqa: E731
            "/api/v1/companies/", {"name": "X", "slug": "x", "admin": admin}, format="json")
        assert post(employee_user.id).status_code == 400
        assert post(company_admin_user.id).status_code == 400  # already runs Acme

    def test_company_with_history_cannot_be_deleted(self, authenticated_admin_client, company, employee):
        r = authenticated_admin_client.delete(f"/api/v1/companies/{company.id}/")
        assert r.status_code == 409
        assert Company.objects.filter(id=company.id).exists()

    def test_empty_company_can_be_deleted(self, authenticated_admin_client):
        c = Company.objects.create(name="Empty", slug="empty")
        assert authenticated_admin_client.delete(f"/api/v1/companies/{c.id}/").status_code == 204

    def test_non_admins_cannot_manage_companies(self, client_for, company, company_admin_user, employee, guard_user):
        for user in (company_admin_user, employee.user, guard_user):
            c = client_for(user)
            assert c.get("/api/v1/companies/").status_code == 403
            assert c.post("/api/v1/companies/", {"name": "H", "slug": "h"}).status_code == 403
            assert c.patch(f"/api/v1/companies/{company.id}/", {"max_employees": 999}).status_code == 403

    def test_stats_scoped_to_own_company(self, client_for, company, other_company, company_admin_user):
        c = client_for(company_admin_user)
        assert c.get(f"/api/v1/companies/{company.id}/stats/").status_code == 200
        assert c.get(f"/api/v1/companies/{other_company.id}/stats/").status_code == 404

    def test_directory_for_guard(self, client_for, company, other_company, guard_user, employee, employee_user):
        other_company.is_active = False
        other_company.save()
        c = client_for(guard_user)
        r = c.get("/api/v1/companies/directory/")
        assert [x["name"] for x in r.data] == ["Acme Towers"]
        r = c.get(f"{EMP_URL}directory/?company={company.id}")
        assert r.status_code == 200 and r.data[0]["name"] == "Asha Rao"
        assert set(r.data[0]) == {"id", "name", "company", "designation", "department"}
        assert c.get(f"{EMP_URL}directory/").status_code == 400
        assert c.get(EMP_URL).status_code == 403  # the full employee list stays private
        assert client_for(employee_user).get("/api/v1/companies/directory/").status_code == 403


class TestEmployees:
    def test_company_admin_creates_employee_in_own_company(self, client_for, company, company_admin_user, api_client):
        r = client_for(company_admin_user).post(EMP_URL, employee_payload(), format="json")
        assert r.status_code == 201, r.data
        assert r.data["company"] == company.id and r.data["username"] == "new.emp"
        assert "password" not in r.data
        assert api_client.post("/api/v1/auth/login/", {"username": "new.emp", "password": STRONG}).status_code == 200

    def test_company_admin_cannot_create_in_other_company(self, client_for, company, other_company, company_admin_user):
        r = client_for(company_admin_user).post(EMP_URL, employee_payload(company=other_company.id), format="json")
        assert r.status_code == 400
        assert not User.objects.filter(username="new.emp").exists()

    def test_admin_must_choose_company(self, authenticated_admin_client, company):
        assert authenticated_admin_client.post(EMP_URL, employee_payload(), format="json").status_code == 400
        r = authenticated_admin_client.post(EMP_URL, employee_payload(company=company.id), format="json")
        assert r.status_code == 201

    def test_duplicate_username_weak_password_and_duplicate_id(self, authenticated_admin_client, company, employee):
        post = lambda **kw: authenticated_admin_client.post(  # noqa: E731
            EMP_URL, employee_payload(company=company.id, **kw), format="json")
        assert post(username="testemployee").status_code == 400
        assert post(password="short").status_code == 400
        assert post(employee_id="E1").status_code == 400
        assert User.objects.filter(role="employee").count() == 1

    def test_blank_employee_ids_do_not_collide(self, authenticated_admin_client, company):
        for n in range(2):
            r = authenticated_admin_client.post(
                EMP_URL, employee_payload(company=company.id, username=f"blank{n}", employee_id=""), format="json")
            assert r.status_code == 201, r.data

    def test_max_employees_enforced(self, authenticated_admin_client, company):
        company.max_employees = 1
        company.save()
        post = lambda n: authenticated_admin_client.post(  # noqa: E731
            EMP_URL, employee_payload(company=company.id, username=f"u{n}", employee_id=f"X{n}"), format="json")
        assert post(1).status_code == 201
        r = post(2)
        assert r.status_code == 400 and "limit" in str(r.data)

    def test_update_employee_details_and_deactivate(self, client_for, company_admin_user, employee, api_client):
        c = client_for(company_admin_user)
        r = c.patch(f"{EMP_URL}{employee.id}/", {"first_name": "Usha", "department": "HR", "is_active": False},
                    format="json")
        assert r.status_code == 200, r.data
        employee.user.refresh_from_db()
        assert employee.user.first_name == "Usha" and not employee.user.is_active
        assert r.data["department"] == "HR"

    def test_company_admin_cannot_touch_other_companys_employee(self, client_for, company, company_admin_user,
                                                                 other_employee):
        c = client_for(company_admin_user)
        assert c.patch(f"{EMP_URL}{other_employee.id}/", {"department": "x"}).status_code == 404
        assert c.delete(f"{EMP_URL}{other_employee.id}/").status_code == 404
        assert c.get(EMP_URL).data["count"] == 0

    def test_delete_employee_removes_login(self, client_for, company_admin_user, employee):
        user_id = employee.user_id
        assert client_for(company_admin_user).delete(f"{EMP_URL}{employee.id}/").status_code == 204
        assert not User.objects.filter(id=user_id).exists()

    def test_employees_and_guards_cannot_manage_employees(self, client_for, employee, guard_user):
        for user in (employee.user, guard_user):
            assert client_for(user).post(EMP_URL, employee_payload(), format="json").status_code == 403


class TestBulkUpload:
    url = EMP_URL + "bulk-upload/"

    def upload(self, client, text, **extra):
        f = io.BytesIO(text.encode())
        f.name = "employees.csv"
        return client.post(self.url, {"file": f, **extra}, format="multipart")

    def test_mixed_rows(self, client_for, company, company_admin_user, employee):
        csv_text = (
            "username,email,first_name,last_name,password,employee_id,department\n"
            f"ok.one,one@acme.test,Ok,One,{STRONG},B1,Ops\n"
            f"testemployee,dup@acme.test,Dup,User,{STRONG},B2,Ops\n"
            "weak.pw,weak@acme.test,Weak,Pw,12345678,B3,Ops\n"
            f"dup.id,dupid@acme.test,Dup,Id,{STRONG},E1,Ops\n"
            "\n"
            f"ok.two,two@acme.test,Ok,Two,{STRONG},,Ops\n"
        )
        r = self.upload(client_for(company_admin_user), csv_text)
        assert r.status_code == 201, r.data
        assert r.data["created"] == 2
        assert [e["row"] for e in r.data["errors"]] == [3, 4, 5]
        # Failed rows must not leave half-created logins behind.
        assert not User.objects.filter(username__in=["weak.pw", "dup.id"]).exists()
        assert Employee.objects.filter(company=company).count() == 3

    def test_missing_columns_rejected(self, client_for, company, company_admin_user):
        r = self.upload(client_for(company_admin_user), "username,email\na,b@c.test\n")
        assert r.status_code == 400 and "password" in str(r.data)

    def test_no_default_password(self, client_for, company, company_admin_user):
        csv_text = "username,email,first_name,last_name,password\nnopw,no@acme.test,No,Pw,\n"
        r = self.upload(client_for(company_admin_user), csv_text)
        assert r.status_code == 400 and r.data["created"] == 0
        assert not User.objects.filter(username="nopw").exists()

    def test_respects_employee_limit(self, client_for, company, company_admin_user):
        company.max_employees = 1
        company.save()
        rows = "".join(f"b{n},b{n}@acme.test,B,{n},{STRONG}\n" for n in range(3))
        r = self.upload(client_for(company_admin_user), "username,email,first_name,last_name,password\n" + rows)
        assert r.data["created"] == 1 and len(r.data["errors"]) == 2

    def test_company_admin_cannot_upload_to_other_company(self, client_for, company, other_company, company_admin_user):
        csv_text = f"username,email,first_name,last_name,password\nzz,zz@x.test,Z,Z,{STRONG}\n"
        r = self.upload(client_for(company_admin_user), csv_text, company=other_company.id)
        assert r.status_code == 400
        assert not User.objects.filter(username="zz").exists()
