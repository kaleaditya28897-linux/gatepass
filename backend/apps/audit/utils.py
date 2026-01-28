from .models import AuditLog


def log_action(user, action, resource_type, resource_id="", description="", request=None, extra_data=None):
    ip_address = None
    user_agent = ""
    if request:
        ip_address = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", ""))
        if ip_address and "," in ip_address:
            ip_address = ip_address.split(",")[0].strip()
        user_agent = request.META.get("HTTP_USER_AGENT", "")
    AuditLog.objects.create(
        user=user,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id),
        description=description,
        ip_address=ip_address or None,
        user_agent=user_agent,
        extra_data=extra_data or {},
    )
