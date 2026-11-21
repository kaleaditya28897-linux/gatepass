from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Limits password guessing against one account from one address.

    Keyed on address + username so that a whole office behind a single public
    IP can still sign in at the same time in the morning.
    """

    scope = "login"

    def get_cache_key(self, request, view):
        username = str(request.data.get("username", "")).strip().lower()[:150]
        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{self.get_ident(request)}:{username}",
        }


class LoginAddressRateThrottle(AnonRateThrottle):
    """Looser overall cap per address, to slow down username spraying."""

    scope = "login_address"

    def get_cache_key(self, request, view):
        # Throttle by address even if a (stale) token is sent along.
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class PassVerifyRateThrottle(LoginAddressRateThrottle):
    """Caps anonymous pass lookups per address. Pass codes are unguessable, so this
    only needs to stop abuse; it is generous because many visitors can share the
    building Wi-Fi. Signed-in gate staff are never slowed down."""

    scope = "pass_verify"

    def allow_request(self, request, view):
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated and user.role in ("guard", "admin"):
            return True
        return super().allow_request(request, view)


class OTPVerifyRateThrottle(UserRateThrottle):
    scope = "otp_verify"
