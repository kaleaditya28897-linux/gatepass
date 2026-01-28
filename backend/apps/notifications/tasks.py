from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone


@shared_task
def send_sms_notification(notification_id):
    from .models import Notification
    notification = Notification.objects.get(id=notification_id)
    try:
        backend = getattr(settings, "SMS_BACKEND", "console")
        if backend == "console":
            print(f"[SMS] To: {notification.recipient_phone} | Message: {notification.message}")
        elif backend == "twilio":
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            client.messages.create(
                body=notification.message,
                from_=settings.TWILIO_FROM_NUMBER,
                to=notification.recipient_phone,
            )
        notification.status = Notification.Status.SENT
        notification.sent_at = timezone.now()
        notification.save()
    except Exception as e:
        notification.status = Notification.Status.FAILED
        notification.error_message = str(e)
        notification.save()


@shared_task
def send_email_notification(notification_id):
    from .models import Notification
    notification = Notification.objects.get(id=notification_id)
    try:
        send_mail(
            subject=notification.subject,
            message=notification.message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[notification.recipient_email],
        )
        notification.status = Notification.Status.SENT
        notification.sent_at = timezone.now()
        notification.save()
    except Exception as e:
        notification.status = Notification.Status.FAILED
        notification.error_message = str(e)
        notification.save()


@shared_task
def notify_pass_approved(pass_id):
    from apps.passes.models import VisitorPass
    from .models import Notification
    visitor_pass = VisitorPass.objects.select_related("host_company").get(id=pass_id)
    pass_url = f"{settings.FRONTEND_URL}/pass/{visitor_pass.pass_code}"
    message = (
        f"Your visitor pass for {visitor_pass.host_company.name} has been approved. "
        f"Show this QR code at the gate: {pass_url}"
    )
    if visitor_pass.visitor_phone:
        notif = Notification.objects.create(
            recipient_phone=visitor_pass.visitor_phone,
            channel=Notification.Channel.SMS,
            message=message,
        )
        send_sms_notification.delay(notif.id)
    if visitor_pass.visitor_email:
        notif = Notification.objects.create(
            recipient_email=visitor_pass.visitor_email,
            channel=Notification.Channel.EMAIL,
            subject="Your Visitor Pass is Approved",
            message=message,
        )
        send_email_notification.delay(notif.id)


@shared_task
def notify_visitor_checked_in(pass_id):
    from apps.passes.models import VisitorPass
    from .models import Notification
    visitor_pass = VisitorPass.objects.select_related("host_employee__user").get(id=pass_id)
    if visitor_pass.host_employee:
        host_user = visitor_pass.host_employee.user
        message = f"Your visitor {visitor_pass.visitor_name} has checked in at the gate."
        if host_user.phone:
            notif = Notification.objects.create(
                recipient=host_user,
                recipient_phone=host_user.phone,
                channel=Notification.Channel.SMS,
                message=message,
            )
            send_sms_notification.delay(notif.id)


@shared_task
def notify_delivery_arrived(delivery_id):
    from apps.deliveries.models import Delivery
    from .models import Notification
    delivery = Delivery.objects.select_related("employee__user").get(id=delivery_id)
    user = delivery.employee.user
    message = (
        f"Your {delivery.get_delivery_type_display()} from {delivery.platform_name or 'unknown'} "
        f"has arrived at the gate. OTP: {delivery.otp_code}"
    )
    if user.phone:
        notif = Notification.objects.create(
            recipient=user,
            recipient_phone=user.phone,
            channel=Notification.Channel.SMS,
            message=message,
        )
        send_sms_notification.delay(notif.id)
