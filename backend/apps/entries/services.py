"""Gate operations shared by the entry, pass and delivery endpoints."""
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.audit.utils import log_action
from apps.deliveries.models import Delivery
from apps.gates.models import Gate
from apps.notifications.tasks import notify_delivery_arrived, notify_visitor_checked_in
from apps.passes.models import VisitorPass
from .models import EntryLog


class GateError(Exception):
    def __init__(self, detail, status_code=status.HTTP_400_BAD_REQUEST):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def get_active_gate(gate_id):
    try:
        return Gate.objects.get(id=gate_id, is_active=True)
    except Gate.DoesNotExist:
        raise GateError("Gate not found or inactive.", status.HTTP_404_NOT_FOUND)


@transaction.atomic
def check_in_visitor(pass_code, gate, user, request=None):
    try:
        # Lock the pass so two guards scanning the same QR cannot both succeed.
        visitor_pass = (
            VisitorPass.objects.select_for_update()
            .select_related("host_company")
            .get(pass_code=pass_code)
        )
    except VisitorPass.DoesNotExist:
        raise GateError("Pass not found.", status.HTTP_404_NOT_FOUND)

    if EntryLog.objects.filter(visitor_pass=visitor_pass, check_out_time__isnull=True).exists():
        raise GateError("This pass is already checked in.")
    if visitor_pass.status != VisitorPass.Status.APPROVED:
        raise GateError(f"Pass status is '{visitor_pass.get_status_display()}'. Cannot check in.")
    now = timezone.now()
    if visitor_pass.valid_until < now:
        raise GateError("Pass has expired.")
    earliest = visitor_pass.valid_from - timedelta(minutes=settings.PASS_EARLY_CHECKIN_MINUTES)
    if now < earliest:
        local_start = timezone.localtime(visitor_pass.valid_from).strftime("%d %b %Y, %I:%M %p")
        raise GateError(f"This pass is not valid yet. It starts on {local_start}.")

    visitor_pass.status = VisitorPass.Status.CHECKED_IN
    visitor_pass.save(update_fields=["status", "updated_at"])
    entry = EntryLog.objects.create(
        gate=gate,
        checked_in_by=user,
        visitor_pass=visitor_pass,
        entry_type=EntryLog.EntryType.VISITOR,
        visitor_name=visitor_pass.visitor_name,
        phone=visitor_pass.visitor_phone,
        company_name=visitor_pass.host_company.name,
    )
    log_action(
        user=user,
        action="visitor_checked_in",
        resource_type="entry_log",
        resource_id=entry.id,
        description=f"Checked in visitor {entry.visitor_name} at {gate.name}.",
        request=request,
        extra_data={"visitor_pass_id": visitor_pass.id, "gate_id": gate.id},
    )
    pass_id = visitor_pass.id
    transaction.on_commit(lambda: notify_visitor_checked_in.delay(pass_id))
    return entry


@transaction.atomic
def check_in_delivery(delivery_id, gate, user, request=None):
    try:
        delivery = Delivery.objects.select_for_update().select_related("company").get(id=delivery_id)
    except Delivery.DoesNotExist:
        raise GateError("Delivery not found.", status.HTTP_404_NOT_FOUND)
    if EntryLog.objects.filter(delivery=delivery, check_out_time__isnull=True).exists():
        raise GateError("This delivery already has an active entry.")
    if delivery.status != Delivery.Status.EXPECTED:
        raise GateError(f"Delivery status is '{delivery.get_status_display()}'. Cannot mark as arrived.")

    delivery.status = Delivery.Status.ARRIVED
    delivery.save(update_fields=["status", "updated_at"])
    entry = EntryLog.objects.create(
        gate=gate,
        checked_in_by=user,
        delivery=delivery,
        entry_type=EntryLog.EntryType.DELIVERY,
        visitor_name=delivery.delivery_person_name or delivery.platform_name or "Delivery",
        phone=delivery.delivery_person_phone,
        company_name=delivery.company.name,
    )
    log_action(
        user=user,
        action="delivery_arrived",
        resource_type="delivery",
        resource_id=delivery.id,
        description=f"Delivery {delivery.id} arrived at {gate.name}.",
        request=request,
        extra_data={"entry_id": entry.id, "gate_id": gate.id},
    )
    transaction.on_commit(lambda: notify_delivery_arrived.delay(delivery.id))
    return entry


@transaction.atomic
def check_out_entry(entry_id, user, request=None):
    try:
        entry = EntryLog.objects.select_for_update().get(id=entry_id, check_out_time__isnull=True)
    except EntryLog.DoesNotExist:
        raise GateError("Active entry not found.", status.HTTP_404_NOT_FOUND)
    now = timezone.now()
    entry.check_out_time = now
    entry.checked_out_by = user
    entry.save(update_fields=["check_out_time", "checked_out_by", "updated_at"])
    visitor_pass = entry.visitor_pass
    if visitor_pass is not None and visitor_pass.status == VisitorPass.Status.CHECKED_IN:
        # Recurring passes can be used again until they run out.
        if visitor_pass.pass_type == VisitorPass.PassType.RECURRING and visitor_pass.valid_until > now:
            visitor_pass.status = VisitorPass.Status.APPROVED
        else:
            visitor_pass.status = VisitorPass.Status.CHECKED_OUT
        visitor_pass.save(update_fields=["status", "updated_at"])
    log_action(
        user=user,
        action="entry_checked_out",
        resource_type="entry_log",
        resource_id=entry.id,
        description=f"Checked out {entry.visitor_name}.",
        request=request,
        extra_data={"visitor_pass_id": entry.visitor_pass_id, "delivery_id": entry.delivery_id},
    )
    return entry
