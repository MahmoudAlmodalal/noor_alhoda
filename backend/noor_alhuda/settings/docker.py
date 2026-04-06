"""
Docker development settings.
PostgreSQL database (like production) with DEBUG=True (like local).
"""

from decouple import config

from .base import *  # noqa: F401,F403

DEBUG = True

# Database — PostgreSQL via environment variables (set in docker-compose.yml)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="noor_alhuda"),
        "USER": config("DB_USER", default="postgres"),
        "PASSWORD": config("DB_PASSWORD", default="postgres"),
        "HOST": config("DB_HOST", default="db"),
        "PORT": config("DB_PORT", default="5432"),
    }
}

# Allow all origins in Docker dev
CORS_ALLOW_ALL_ORIGINS = True

# Disable whitenoise caching in dev
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
