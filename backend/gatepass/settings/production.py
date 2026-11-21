from .base import *  # noqa: F401, F403
from django.core.exceptions import ImproperlyConfigured
from decouple import config

DEBUG = False

ALLOWED_HOSTS = split_csv(config("ALLOWED_HOSTS", default=""))

if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("ALLOWED_HOSTS must be configured in production.")

INSECURE_SECRET_KEYS = {
    "django-insecure-change-me-in-production",
    "your-secret-key-here",
    "replace-with-a-long-random-secret",
}
if SECRET_KEY in INSECURE_SECRET_KEYS or len(SECRET_KEY) < 32:
    raise ImproperlyConfigured(
        "SECRET_KEY must be set to a unique random value of at least 32 characters in production."
    )

# Container healthchecks and the internal reverse proxy talk to Django directly.
for internal_host in ("localhost", "127.0.0.1", "backend"):
    if internal_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(internal_host)

CORS_ALLOWED_ORIGINS = split_csv(config("CORS_ALLOWED_ORIGINS", default=""))
CSRF_TRUSTED_ORIGINS = split_csv(config("CSRF_TRUSTED_ORIGINS", default=""))

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
# The health endpoint is polled over plain HTTP from inside the container network.
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/$"]
SESSION_COOKIE_SECURE = SECURE_SSL_REDIRECT
CSRF_COOKIE_SECURE = SECURE_SSL_REDIRECT
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=31536000, cast=int) if SECURE_SSL_REDIRECT else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = config("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=False, cast=bool)
SECURE_HSTS_PRELOAD = config("SECURE_HSTS_PRELOAD", default=False, cast=bool)
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
# HSTS for subdomains / preload is a decision about the whole domain, not just
# GatePass, so it stays opt-in.
SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Only JSON in production: no browsable API.
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = ("rest_framework.renderers.JSONRenderer",)
if REST_FRAMEWORK.get("NUM_PROXIES") is None:
    REST_FRAMEWORK["NUM_PROXIES"] = 1

# Email: real SMTP only when a host account is configured, otherwise log to the console
# so notification tasks do not fail on an unconfigured server.
EMAIL_HOST = config("EMAIL_HOST", default="")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_TIMEOUT = 20
if EMAIL_HOST and EMAIL_HOST_USER:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

DATABASES["default"]["CONN_MAX_AGE"] = config("DB_CONN_MAX_AGE", default=60, cast=int)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
DATABASES["default"].setdefault("OPTIONS", {})
DATABASES["default"]["OPTIONS"]["sslmode"] = config("DB_SSLMODE", default="prefer")
