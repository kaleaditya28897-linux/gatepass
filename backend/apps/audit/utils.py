import ipaddress

from .models import AuditLog


def get_client_ip(request):
    """Best-effort client address.

    Prefers X-Real-IP (set by the bundled reverse proxy), then the first
    X-Forwarded-For hop, then the socket address. Anything that is not a valid
    IP is discarded so a forged header can never break the request.
    """
    meta = request.META
    candidates = [
        meta.get("HTTP_X_REAL_IP", ""),
        meta.get("HTTP_X_FORWARDED_FOR", "").split(",")[0],
        meta.get("REMOTE_ADDR", ""),
    ]
    for candidate in candidates:
        candidate = candidate.strip()
        if not candidate:
            continue
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            continue
    return None


def log_action(user, action, resource_type, resource_id="", description="", request=None, extra_data=None):
    ip_address = None
    user_agent = ""
    if request is not None:
        ip_address = get_client_ip(request)
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:1000]
    if user is not None and not getattr(user, "is_authenticated", False):
        user = None
    return AuditLog.objects.create(
        user=user,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id),
        description=description,
        ip_address=ip_address,
        user_agent=user_agent,
        extra_data=extra_data or {},
    )
