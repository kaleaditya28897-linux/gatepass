"""End-to-end API coverage for the pass -> gate -> delivery workflows."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.deliveries.models import Delivery
from apps.entries.models import EntryLog
from apps.gates.models import GuardProfile, GuardShift
from apps.notifications.models import Notification
from apps.passes.models import VisitorPass

User = get_user_model()
pytestmark = pytest.mark.django_db
STRONG = "Tr1cky-Horse-Battery"
PASSES = "/api/v1/passes/"
ENTRIES = "/api/v1/entries/"
DELIVERIES = "/api/v1/deliveries/"


def pass_payload(**overrides):
    now = timezone.now()
    data = {
        "visitor_name": "Nina Guest", "visitor_phone": "+919222222222", "visitor_email": "nina@guest.test",
        "purpose": "Meeting",
        "valid_from": (now + timedelta(minutes=10)).isoformat(),
        "valid_until": (now + timedelta(hours=3)).isoformat(),
    }
    data.update(overrides)
    return data


# --------------------------------------------------------------------------- gates & guards

class TestGatesAndGuards:
    def test_guard_can_read_but_not_change_gates(self, client_for, guard_user, gate):
        c = client_for(guard_user)
        assert c.get("/api/v1/gates/").data["count"] == 1
        assert c.post("/api/v1/gates/", {"name": "X", "code": "X"}).status_code == 403
        assert c.delete(f"/api/v1/gates/{gate.id}/").status_code == 403

    def test_other_roles_cannot_read_gates(self, client_for, employee, company_admin_user):
        for user in (employee.user, company_admin_user):
            assert client_for(user).get("/api/v1/gates/").status_code == 403

    def test_admin_creates_updates_and_removes_guard(self, authenticated_admin_client, api_client):
        r = authenticated_admin_client.post("/api/v1/guards/", {
            "username": "guard.new", "first_name": "Ravi", "password": STRONG, "badge_number": "G-77",
        }, format="json")
        assert r.status_code == 201, r.data
        assert r.data["badge_number"] == "G-77" and r.data["full_name"] == "Ravi"
        guard_id = r.data["id"]
        login = lambda: api_client.post(  # noqa: E731
            "/api/v1/auth/login/", {"username": "guard.new", "password": STRONG}).status_code
        assert login() == 200
        # Duplicate badge / username are validation errors, not crashes.
        dup = authenticated_admin_client.post("/api/v1/guards/", {
            "username": "guard.two", "first_name": "R", "password": STRONG, "badge_number": "G-77"}, format="json")
        assert dup.status_code == 400
        assert not User.objects.filter(username="guard.two").exists()
        # Deactivating the guard blocks their login.
        r = authenticated_admin_client.patch(f"/api/v1/guards/{guard_id}/", {"is_active": False, "phone": "+9190"},
                                             format="json")
        assert r.status_code == 200 and r.data["phone"] == "+9190"
        assert login() == 401
        assert authenticated_admin_client.delete(f"/api/v1/guards/{guard_id}/").status_code == 204
        assert not User.objects.filter(username="guard.new").exists()

    def test_shift_validation_and_my_current(self, authenticated_admin_client, client_for, guard, gate):
        now = timezone.now()
        bad = authenticated_admin_client.post("/api/v1/shifts/", {
            "guard": guard.id, "gate": gate.id,
            "shift_start": now.isoformat(), "shift_end": (now - timedelta(hours=1)).isoformat()}, format="json")
        assert bad.status_code == 400
        c = client_for(guard.user)
        assert c.get("/api/v1/shifts/my-current/").status_code == 204
        ok = authenticated_admin_client.post("/api/v1/shifts/", {
            "guard": guard.id, "gate": gate.id,
            "shift_start": (now - timedelta(hours=1)).isoformat(),
            "shift_end": (now + timedelta(hours=7)).isoformat()}, format="json")
        assert ok.status_code == 201, ok.data
        r = c.get("/api/v1/shifts/my-current/")
        assert r.status_code == 200 and r.data["gate"] == gate.id
        assert c.get("/api/v1/shifts/").status_code == 403


# --------------------------------------------------------------------------- pass lifecycle

class TestPassCreation:
    def test_employee_pass_is_pending_and_bound_to_them(self, client_for, employee, other_company):
        # No host fields needed; attempts to point at another company are rejected.
        c = client_for(employee.user)
        r = c.post(PASSES, pass_payload(), format="json")
        assert r.status_code == 201, r.data
        assert r.data["status"] == "pending"
        assert r.data["host_employee"] == employee.id and r.data["host_company"] == employee.company_id
        assert r.data["qr_code_image"] is None
        assert c.post(PASSES, pass_payload(host_company=other_company.id), format="json").status_code == 400

    def test_employee_cannot_self_approve_or_set_status(self, client_for, employee):
        c = client_for(employee.user)
        r = c.post(PASSES, pass_payload(status="approved", approved_by=employee.user_id), format="json")
        assert r.data["status"] == "pending"
        assert c.post(f"{PASSES}{r.data['id']}/approve/").status_code == 403

    def test_company_admin_pass_is_auto_approved_with_qr_and_notifications(
        self, client_for, company, company_admin_user, employee, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            r = client_for(company_admin_user).post(PASSES, pass_payload(host_employee=employee.id), format="json")
        assert r.status_code == 201, r.data
        assert r.data["status"] == "approved" and r.data["qr_code_image"]
        assert r.data["pass_url"].endswith(f"/pass/{r.data['pass_code']}")
        assert Notification.objects.filter(channel="sms", status="sent").count() == 1
        assert len(mail.outbox) == 1 and r.data["pass_code"] in mail.outbox[0].body

    def test_validity_rules(self, client_for, employee):
        c = client_for(employee.user)
        now = timezone.now()
        backwards = pass_payload(valid_from=(now + timedelta(hours=2)).isoformat(),
                                 valid_until=(now + timedelta(hours=1)).isoformat())
        in_past = pass_payload(valid_from=(now - timedelta(days=2)).isoformat(),
                               valid_until=(now - timedelta(days=1)).isoformat())
        assert c.post(PASSES, backwards, format="json").status_code == 400
        assert c.post(PASSES, in_past, format="json").status_code == 400

    def test_company_admin_host_must_be_in_own_company(self, client_for, company, company_admin_user, other_employee,
                                                       other_company):
        c = client_for(company_admin_user)
        assert c.post(PASSES, pass_payload(host_employee=other_employee.id), format="json").status_code == 400
        assert c.post(PASSES, pass_payload(host_company=other_company.id), format="json").status_code == 400

    def test_inactive_company_cannot_host(self, authenticated_admin_client, company):
        company.is_active = False
        company.save()
        r = authenticated_admin_client.post(PASSES, pass_payload(host_company=company.id), format="json")
        assert r.status_code == 400

    def test_guard_cannot_use_pass_api(self, client_for, guard_user, make_pass):
        c = client_for(guard_user)
        assert c.get(PASSES).status_code == 403
        assert c.post(PASSES, pass_payload(), format="json").status_code == 403


class TestPassVisibilityAndChanges:
    def test_isolation_between_companies_and_employees(self, client_for, make_pass, company_admin_user,
                                                       other_company, other_employee, employee):
        mine = make_pass()
        theirs = make_pass(host_company=other_company, host_employee=other_employee)
        for user in (company_admin_user, employee.user):
            c = client_for(user)
            assert [p["id"] for p in c.get(PASSES).data["results"]] == [mine.id]
            assert c.get(f"{PASSES}{theirs.id}/").status_code == 404
            assert c.post(f"{PASSES}{theirs.id}/cancel/").status_code == 404
        assert client_for(company_admin_user).post(f"{PASSES}{theirs.id}/approve/").status_code == 404

    def test_approved_pass_cannot_be_edited_to_extend_validity(self, client_for, employee, make_pass):
        p = make_pass()
        later = (timezone.now() + timedelta(days=30)).isoformat()
        r = client_for(employee.user).patch(f"{PASSES}{p.id}/", {"valid_until": later}, format="json")
        assert r.status_code == 400
        p.refresh_from_db()
        assert p.valid_until < timezone.now() + timedelta(days=1)

    def test_pending_pass_can_be_edited(self, client_for, employee, make_pass):
        p = make_pass(status="pending")
        r = client_for(employee.user).patch(f"{PASSES}{p.id}/", {"purpose": "Updated"}, format="json")
        assert r.status_code == 200 and r.data["purpose"] == "Updated"

    def test_cancel_and_delete_rules(self, client_for, employee, make_pass, authenticated_admin_client):
        p = make_pass()
        c = client_for(employee.user)
        assert c.delete(f"{PASSES}{p.id}/").status_code == 403
        assert c.post(f"{PASSES}{p.id}/cancel/").data["status"] == "cancelled"
        assert c.post(f"{PASSES}{p.id}/cancel/").status_code == 400
        assert authenticated_admin_client.delete(f"{PASSES}{p.id}/").status_code == 204

    def test_reject_records_reason_and_blocks_checkin(self, client_for, company_admin_user, guard_user, gate, make_pass):
        p = make_pass(status="pending")
        r = client_for(company_admin_user).post(f"{PASSES}{p.id}/reject/", {"reason": "Unknown visitor"}, format="json")
        assert r.data["status"] == "rejected" and r.data["rejected_reason"] == "Unknown visitor"
        r = client_for(guard_user).post(f"{ENTRIES}check-in/", {"pass_code": str(p.pass_code), "gate": gate.id})
        assert r.status_code == 400

    def test_expired_pending_pass_cannot_be_approved(self, client_for, company_admin_user, make_pass):
        now = timezone.now()
        p = make_pass(status="pending", valid_from=now - timedelta(hours=3), valid_until=now - timedelta(hours=1))
        c = client_for(company_admin_user)
        assert c.get(f"{PASSES}{p.id}/").data["status"] == "expired"
        assert c.post(f"{PASSES}{p.id}/approve/").status_code == 400


class TestPublicVerify:
    def test_public_view_hides_personal_details(self, api_client, make_pass):
        p = make_pass(id_type="Aadhaar", id_number="1234-5678", vehicle_number="KA01AB1234")
        r = api_client.get(f"{PASSES}verify/{p.pass_code}/")
        assert r.status_code == 200
        assert r.data["visitor_name"] == "Vik Visitor" and r.data["status"] == "approved"
        for private in ("visitor_phone", "id_number", "id_type", "vehicle_number", "photo", "visitor_email", "id"):
            assert private not in r.data

    def test_guard_sees_full_details(self, client_for, guard_user, make_pass):
        p = make_pass(id_number="1234-5678")
        r = client_for(guard_user).get(f"{PASSES}verify/{p.pass_code}/")
        assert r.data["id_number"] == "1234-5678" and r.data["visitor_phone"]
        assert r.data["pass_code"] == str(p.pass_code) and r.data["active_entry"] is None

    def test_employee_token_gets_public_view_only(self, client_for, other_employee, make_pass):
        p = make_pass(id_number="1234-5678")
        assert "id_number" not in client_for(other_employee.user).get(f"{PASSES}verify/{p.pass_code}/").data

    def test_malformed_code_is_404_not_500(self, api_client):
        for code in ("not-a-uuid", "123", "%27%20OR%201=1"):
            assert api_client.get(f"{PASSES}verify/{code}/").status_code == 404

    def test_lookup_throttle_spares_gate_staff(self, api_client, client_for, guard_user, make_pass, monkeypatch):
        from apps.core.throttles import PassVerifyRateThrottle
        monkeypatch.setattr(PassVerifyRateThrottle, "THROTTLE_RATES", {"pass_verify": "2/min"})
        url = f"{PASSES}verify/{make_pass().pass_code}/"
        assert [api_client.get(url).status_code for _ in range(3)] == [200, 200, 429]
        guard = client_for(guard_user)
        assert {guard.get(url).status_code for _ in range(5)} == {200}

    def test_expired_pass_shows_as_expired(self, api_client, make_pass):
        now = timezone.now()
        p = make_pass(valid_from=now - timedelta(hours=3), valid_until=now - timedelta(minutes=1))
        assert api_client.get(f"{PASSES}verify/{p.pass_code}/").data["status"] == "expired"


# --------------------------------------------------------------------------- gate check-in / out

class TestCheckIn:
    def check_in(self, client, p, gate):
        return client.post(f"{ENTRIES}check-in/", {"pass_code": str(p.pass_code), "gate": gate.id}, format="json")

    def test_full_visit(self, client_for, guard_user, gate, make_pass, employee, django_capture_on_commit_callbacks):
        p = make_pass()
        c = client_for(guard_user)
        with django_capture_on_commit_callbacks(execute=True):
            r = self.check_in(c, p, gate)
        assert r.status_code == 201, r.data
        assert r.data["visitor_name"] == "Vik Visitor" and r.data["gate_name"] == "Main Gate"
        p.refresh_from_db()
        assert p.status == "checked_in"
        # Host is told by SMS.
        assert Notification.objects.filter(recipient=employee.user, status="sent").count() == 1
        # Guard can see who is inside, a second scan is refused.
        assert c.get(f"{ENTRIES}active/").data["count"] == 1
        assert self.check_in(c, p, gate).status_code == 400
        out = c.post(f"{ENTRIES}{r.data['id']}/check-out/")
        assert out.status_code == 200 and out.data["check_out_time"]
        p.refresh_from_db()
        assert p.status == "checked_out"
        assert c.get(f"{ENTRIES}active/").data["count"] == 0
        assert c.post(f"{ENTRIES}{r.data['id']}/check-out/").status_code == 404
        assert self.check_in(c, p, gate).status_code == 400  # single-use
        assert AuditLog.objects.filter(action__in=["visitor_checked_in", "entry_checked_out"]).count() == 2

    @pytest.mark.parametrize("status", ["pending", "rejected", "cancelled", "expired", "checked_out"])
    def test_only_approved_passes_get_in(self, client_for, guard_user, gate, make_pass, status):
        r = self.check_in(client_for(guard_user), make_pass(status=status), gate)
        assert r.status_code == 400
        assert EntryLog.objects.count() == 0

    def test_expired_and_not_yet_valid(self, client_for, guard_user, gate, make_pass):
        now = timezone.now()
        c = client_for(guard_user)
        expired = make_pass(valid_from=now - timedelta(hours=3), valid_until=now - timedelta(minutes=1))
        tomorrow = make_pass(valid_from=now + timedelta(days=1), valid_until=now + timedelta(days=1, hours=2))
        soon = make_pass(valid_from=now + timedelta(minutes=20), valid_until=now + timedelta(hours=2))
        assert "expired" in self.check_in(c, expired, gate).data["detail"]
        assert "not valid yet" in self.check_in(c, tomorrow, gate).data["detail"]
        assert self.check_in(c, soon, gate).status_code == 201  # inside the early-arrival grace

    def test_inactive_or_missing_gate(self, client_for, guard_user, gate, make_pass):
        gate.is_active = False
        gate.save()
        c = client_for(guard_user)
        assert self.check_in(c, make_pass(), gate).status_code == 404
        assert c.post(f"{ENTRIES}check-in/", {"pass_code": "garbage", "gate": gate.id}).status_code == 400
        assert c.post(f"{ENTRIES}check-in/", {"gate": gate.id}).status_code == 400

    def test_recurring_pass_can_re_enter(self, client_for, guard_user, gate, make_pass):
        p = make_pass(pass_type="recurring")
        c = client_for(guard_user)
        for _ in range(2):
            entry = self.check_in(c, p, gate)
            assert entry.status_code == 201
            assert c.post(f"{ENTRIES}{entry.data['id']}/check-out/").status_code == 200
        p.refresh_from_db()
        assert p.status == "approved" and EntryLog.objects.count() == 2

    def test_who_may_use_gate_endpoints(self, client_for, employee, company_admin_user, admin_user, gate, make_pass,
                                        guard_user):
        p = make_pass()
        for user in (employee.user, company_admin_user, admin_user):
            assert self.check_in(client_for(user), p, gate).status_code == 403
        entry = self.check_in(client_for(guard_user), p, gate).data
        assert client_for(employee.user).get(ENTRIES).status_code == 403
        assert client_for(employee.user).post(f"{ENTRIES}{entry['id']}/check-out/").status_code == 403
        assert client_for(company_admin_user).post(f"{ENTRIES}{entry['id']}/check-out/").status_code == 403
        # Building admin may force a check-out (e.g. guard forgot).
        assert client_for(admin_user).post(f"{ENTRIES}{entry['id']}/check-out/").status_code == 200

    def test_entry_log_scoping_filters_and_export(self, client_for, guard_user, gate, make_pass, company_admin_user,
                                                  other_company, other_employee, admin_user):
        c = client_for(guard_user)
        self.check_in(c, make_pass(), gate)
        self.check_in(c, make_pass(host_company=other_company, host_employee=other_employee,
                                   visitor_name="=HYPERLINK(evil)"), gate)
        assert client_for(company_admin_user).get(ENTRIES).data["count"] == 1
        admin = client_for(admin_user)
        assert admin.get(ENTRIES).data["count"] == 2
        today = timezone.localdate().isoformat()
        assert admin.get(f"{ENTRIES}?date_from={today}&date_to={today}").data["count"] == 2
        assert admin.get(f"{ENTRIES}?date_to=2000-01-01").data["count"] == 0
        assert admin.get(f"{ENTRIES}?search=Vik").data["count"] == 1
        export = admin.get(f"{ENTRIES}export/")
        body = b"".join(export.streaming_content).decode()
        assert export["Content-Type"] == "text/csv" and "Vik Visitor" in body
        assert "'=HYPERLINK" in body  # formula injection neutralised
        assert client_for(company_admin_user).get(f"{ENTRIES}export/").status_code == 403


class TestWalkIn:
    url = PASSES + "walk-in/"

    def payload(self, company, **extra):
        return {"visitor_name": "Wally Walkin", "visitor_phone": "+919333333333", "host_company": company.id, **extra}

    def test_walk_in_with_gate_checks_in_immediately(self, client_for, guard_user, gate, company, employee):
        r = client_for(guard_user).post(self.url, self.payload(company, host_employee=employee.id, gate=gate.id),
                                        format="json")
        assert r.status_code == 201, r.data
        assert r.data["status"] == "checked_in" and r.data["pass_type"] == "walk_in" and r.data["entry"]
        entry = EntryLog.objects.get()
        assert entry.gate == gate and entry.checked_in_by == guard_user

    def test_walk_in_without_gate_is_approved_only(self, client_for, guard_user, company):
        r = client_for(guard_user).post(self.url, self.payload(company), format="json")
        assert r.status_code == 201 and r.data["status"] == "approved" and r.data["entry"] is None
        valid_for = VisitorPass.objects.get().valid_until - timezone.now()
        assert timedelta(hours=7) < valid_for <= timedelta(hours=8)

    def test_bad_gate_creates_nothing(self, client_for, guard_user, company):
        r = client_for(guard_user).post(self.url, self.payload(company, gate=99999), format="json")
        assert r.status_code == 404
        assert VisitorPass.objects.count() == 0

    def test_host_must_match_company_and_only_guards(self, client_for, guard_user, company, other_employee, employee):
        r = client_for(guard_user).post(self.url, self.payload(company, host_employee=other_employee.id), format="json")
        assert r.status_code == 400
        assert client_for(employee.user).post(self.url, self.payload(company), format="json").status_code == 403


# --------------------------------------------------------------------------- deliveries

class TestDeliveries:
    def test_employee_creates_delivery_with_minimal_form(self, client_for, employee):
        r = client_for(employee.user).post(DELIVERIES, {"delivery_type": "food_order", "platform_name": "Zomato"},
                                           format="json")
        assert r.status_code == 201, r.data
        assert r.data["employee"] == employee.id and r.data["company"] == employee.company_id
        assert len(r.data["otp_code"]) == 6 and r.data["otp_code"].isdigit()

    def test_company_admin_creates_for_own_employee_only(self, client_for, company_admin_user, employee, other_employee):
        c = client_for(company_admin_user)
        assert c.post(DELIVERIES, {"employee": employee.id}, format="json").status_code == 201
        assert c.post(DELIVERIES, {"employee": other_employee.id}, format="json").status_code == 400

    def test_isolation(self, client_for, make_delivery, other_company, other_employee, employee, company_admin_user):
        make_delivery()
        theirs = make_delivery(company=other_company, employee=other_employee)
        for user in (employee.user, company_admin_user):
            c = client_for(user)
            assert c.get(DELIVERIES).data["count"] == 1
            assert c.get(f"{DELIVERIES}{theirs.id}/").status_code == 404
            assert c.post(f"{DELIVERIES}{theirs.id}/regenerate-otp/").status_code == 404

    def test_guard_never_sees_otp(self, client_for, guard_user, make_delivery):
        d = make_delivery()
        c = client_for(guard_user)
        listing = c.get(f"{DELIVERIES}pending-gate/")
        assert listing.data["count"] == 1 and "otp_code" not in listing.data["results"][0]
        assert c.get(DELIVERIES).status_code == 403
        assert c.get(f"{DELIVERIES}{d.id}/").status_code == 403
        assert "otp_code" not in c.post(f"{DELIVERIES}{d.id}/arrived/").data

    def test_full_delivery_flow_with_entry_log(self, client_for, guard_user, gate, make_delivery, employee,
                                               django_capture_on_commit_callbacks):
        d = make_delivery()
        c = client_for(guard_user)
        # OTP cannot be verified before arrival.
        assert c.post(f"{DELIVERIES}{d.id}/verify-otp/", {"otp": d.otp_code}).status_code == 400
        with django_capture_on_commit_callbacks(execute=True):
            r = c.post(f"{DELIVERIES}{d.id}/arrived/", {"gate": gate.id, "delivery_person_name": "Ramu"}, format="json")
        assert r.status_code == 200 and r.data["status"] == "arrived"
        entry = EntryLog.objects.get()
        assert entry.entry_type == "delivery" and entry.visitor_name == "Ramu" and entry.check_out_time is None
        sms = Notification.objects.get(recipient=employee.user)
        assert d.otp_code in sms.message and sms.status == "sent"
        assert c.post(f"{DELIVERIES}{d.id}/arrived/").status_code == 400

        wrong = "000000" if d.otp_code != "000000" else "111111"
        bad = c.post(f"{DELIVERIES}{d.id}/verify-otp/", {"otp": wrong})
        assert bad.status_code == 400 and bad.data["attempts_remaining"] == 4
        d.refresh_from_db()
        assert d.status == "arrived"

        ok = c.post(f"{DELIVERIES}{d.id}/verify-otp/", {"otp": d.otp_code})
        assert ok.status_code == 200 and ok.data["verified"] is True
        d.refresh_from_db()
        entry.refresh_from_db()
        assert d.status == "delivered" and d.delivered_at and entry.check_out_time
        assert c.get(f"{DELIVERIES}pending-gate/").data["count"] == 0
        assert c.post(f"{DELIVERIES}{d.id}/verify-otp/", {"otp": d.otp_code}).status_code == 400

    def test_there_is_no_way_to_release_without_the_otp(self, client_for, guard_user, make_delivery):
        d = make_delivery(status="arrived")
        c = client_for(guard_user)
        assert c.post(f"{DELIVERIES}{d.id}/delivered/").status_code == 404
        assert c.patch(f"{DELIVERIES}{d.id}/", {"status": "delivered"}).status_code == 403
        d.refresh_from_db()
        assert d.status == "arrived"

    def test_otp_locks_after_too_many_wrong_attempts_and_can_be_regenerated(
        self, client_for, guard_user, make_delivery, employee
    ):
        d = make_delivery(status="arrived", otp_code="123456")
        c = client_for(guard_user)
        responses = [c.post(f"{DELIVERIES}{d.id}/verify-otp/", {"otp": "654321"}) for _ in range(5)]
        assert all(r.status_code == 400 for r in responses)
        assert responses[-1].data["locked"] is True
        # Even the right code is refused once locked.
        locked = c.post(f"{DELIVERIES}{d.id}/verify-otp/", {"otp": "123456"})
        assert locked.status_code == 400 and locked.data["locked"] is True
        assert c.get(f"{DELIVERIES}pending-gate/").data["results"][0]["otp_locked"] is True
        assert c.post(f"{DELIVERIES}{d.id}/regenerate-otp/").status_code == 403

        fresh = client_for(employee.user).post(f"{DELIVERIES}{d.id}/regenerate-otp/")
        assert fresh.status_code == 200 and fresh.data["otp_attempts"] == 0
        ok = c.post(f"{DELIVERIES}{d.id}/verify-otp/", {"otp": fresh.data["otp_code"]})
        assert ok.status_code == 200

    def test_otp_format_validated(self, client_for, guard_user, make_delivery):
        d = make_delivery(status="arrived")
        for otp in ("12345", "abcdef", "1234567", ""):
            assert client_for(guard_user).post(f"{DELIVERIES}{d.id}/verify-otp/", {"otp": otp}).status_code == 400
        d.refresh_from_db()
        assert d.otp_attempts == 0

    def test_cancel_edit_delete_rules(self, client_for, employee, make_delivery, authenticated_admin_client):
        c = client_for(employee.user)
        arrived = make_delivery(status="arrived")
        assert c.patch(f"{DELIVERIES}{arrived.id}/", {"notes": "x"}, format="json").status_code == 400
        assert c.post(f"{DELIVERIES}{arrived.id}/cancel/").status_code == 400
        d = make_delivery()
        assert c.patch(f"{DELIVERIES}{d.id}/", {"notes": "Leave at desk", "status": "delivered", "otp_code": "111111"},
                       format="json").data["status"] == "expected"
        d.refresh_from_db()
        assert d.otp_code != "111111"
        assert c.delete(f"{DELIVERIES}{d.id}/").status_code == 403
        assert c.post(f"{DELIVERIES}{d.id}/cancel/").data["status"] == "cancelled"
        assert authenticated_admin_client.delete(f"{DELIVERIES}{d.id}/").status_code == 204

    def test_delivery_check_in_via_entries_endpoint(self, client_for, guard_user, gate, make_delivery):
        d = make_delivery()
        r = client_for(guard_user).post(f"{ENTRIES}check-in/", {"delivery_id": d.id, "gate": gate.id}, format="json")
        assert r.status_code == 201 and r.data["entry_type"] == "delivery"
        d.refresh_from_db()
        assert d.status == "arrived"

    def test_otps_are_random_six_digit_strings(self, make_delivery):
        codes = {make_delivery().otp_code for _ in range(30)}
        assert len(codes) > 20 and all(len(c) == 6 and c.isdigit() for c in codes)


# --------------------------------------------------------------------------- analytics, expiry, misc

class TestAnalyticsAndJobs:
    def test_overview_counts_and_permissions(self, client_for, admin_user, company_admin_user, guard_user, gate,
                                             make_pass, make_delivery):
        p = make_pass()
        make_pass(status="pending")
        make_delivery()
        client_for(guard_user).post(f"{ENTRIES}check-in/", {"pass_code": str(p.pass_code), "gate": gate.id})
        r = client_for(admin_user).get("/api/v1/analytics/overview/")
        assert r.status_code == 200
        assert r.data["active_visitors"] == 1 and r.data["checked_in_today"] == 1
        assert r.data["pending_deliveries"] == 1 and r.data["pending_passes"] == 1
        assert r.data["total_passes_today"] == 2
        assert client_for(company_admin_user).get("/api/v1/analytics/overview/").status_code == 403
        hours = client_for(admin_user).get("/api/v1/analytics/peak-hours/").data
        assert hours == [{"hour": timezone.localtime().hour, "count": 1}]
        gates = client_for(company_admin_user).get("/api/v1/analytics/entries-by-gate/").data
        assert gates == [{"gate__name": "Main Gate", "count": 1}]
        stats = client_for(company_admin_user).get("/api/v1/analytics/delivery-stats/?days=abc").data
        assert stats["total"] == 1

    def test_expire_passes_job(self, make_pass):
        from apps.passes.tasks import expire_passes
        now = timezone.now()
        old = dict(valid_from=now - timedelta(days=2), valid_until=now - timedelta(days=1))
        stale_approved, stale_pending = make_pass(**old), make_pass(status="pending", **old)
        inside, live = make_pass(status="checked_in", **old), make_pass()
        assert expire_passes() == 2
        for obj, expected in ((stale_approved, "expired"), (stale_pending, "expired"),
                              (inside, "checked_in"), (live, "approved")):
            obj.refresh_from_db()
            assert obj.status == expected

    def test_audit_log_and_notifications_are_admin_only(self, client_for, admin_user, company_admin_user, guard_user,
                                                        employee):
        for url in ("/api/v1/audit-logs/", "/api/v1/notifications/"):
            assert client_for(admin_user).get(url).status_code == 200
            for user in (company_admin_user, guard_user, employee.user):
                assert client_for(user).get(url).status_code == 403

    def test_every_api_route_requires_authentication(self, api_client):
        for url in ("/api/v1/companies/", "/api/v1/companies/employees/", "/api/v1/gates/", "/api/v1/guards/",
                    "/api/v1/shifts/", PASSES, ENTRIES, DELIVERIES, "/api/v1/notifications/",
                    "/api/v1/analytics/overview/", "/api/v1/audit-logs/", "/api/v1/auth/users/",
                    "/api/v1/companies/directory/", f"{ENTRIES}export/", f"{DELIVERIES}pending-gate/"):
            assert api_client.get(url).status_code == 401, url


class TestManagementCommands:
    def test_seed_refuses_outside_debug(self, settings):
        from django.core.management import call_command
        from django.core.management.base import CommandError
        settings.DEBUG = False
        with pytest.raises(CommandError):
            call_command("seed_demo_data")
        assert User.objects.count() == 0

    def test_seed_demo_logins_work_and_is_idempotent(self, settings, api_client):
        from django.core.management import call_command
        settings.DEBUG = True
        call_command("seed_demo_data")
        call_command("seed_demo_data")
        for username, password in (("admin", "admin123"), ("techcorp_admin", "password123"),
                                   ("amit.kumar", "password123"), ("guard.raju", "password123")):
            r = api_client.post("/api/v1/auth/login/", {"username": username, "password": password})
            assert r.status_code == 200, username
        assert GuardProfile.objects.count() == 2 and GuardShift.objects.count() == 2
        assert VisitorPass.objects.count() == 2 and Delivery.objects.count() == 2
        raju = User.objects.get(username="guard.raju")
        from rest_framework.test import APIClient
        c = APIClient()
        c.force_authenticate(raju)
        assert c.get("/api/v1/shifts/my-current/").status_code == 200

    def test_create_admin_needs_real_password_in_production(self, settings, monkeypatch):
        from django.core.management import call_command
        from django.core.management.base import CommandError
        settings.DEBUG = False
        monkeypatch.delenv("GATEPASS_ADMIN_PASSWORD", raising=False)
        with pytest.raises(CommandError):
            call_command("create_admin")
        with pytest.raises(CommandError):
            call_command("create_admin", password="admin123")
        call_command("create_admin", password=STRONG)
        admin = User.objects.get(username="admin")
        assert admin.role == "admin" and admin.is_superuser and admin.check_password(STRONG)
