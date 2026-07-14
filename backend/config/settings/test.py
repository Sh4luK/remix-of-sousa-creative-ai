import os

os.environ.setdefault("SECRET_KEY", "test-insecure-key-do-not-use-in-production")
os.environ.setdefault("DATABASE_URL", "sqlite://:memory:")
os.environ.setdefault("TURNSTILE_SECRET_KEY", "")

from .base import *  # noqa: E402, F401, F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Desliga throttling nos testes (chamadas repetidas de auth estourariam o limite).
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"login": None, "register": None}}  # noqa: F405
