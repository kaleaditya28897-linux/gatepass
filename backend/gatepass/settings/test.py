from .base import *  # noqa: F401, F403

DEBUG = True

# Use SQLite for testing to avoid PostgreSQL dependency
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",  # Use in-memory database for faster tests
    }
}

# Disable password hashing to speed up tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Use console backends for testing
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
SMS_BACKEND = "console"

# Disable Celery task execution during tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
